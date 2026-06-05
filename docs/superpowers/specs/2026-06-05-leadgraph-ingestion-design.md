# LeadGraph — Data Ingestion Architecture

**Date**: 2026-06-05
**Author**: Sisyphus (LeadGraph)
**Status**: Draft

## Context

Siemens Healthineers produces biological intermediates (proteins, antibodies, latex particles, blockers) at their Marburg site but lacks a B2B sales structure to identify and prioritize leads. LeadGraph builds a Neo4j knowledge graph with AI-powered lead scoring to automatically discover, rank, and surface potential buyers.

This spec covers the data ingestion layer — how leads enter the system.

## Goal

Build a **plugin-based ingestion architecture** where each data source is a `SourceAdapter` implementation. The system ships with one **real adapter** (FDA 510(k) database) and multiple **stub/scenario adapters** to demonstrate the full pipeline during the hackathon pitch.

## SourceAdapter Interface

```typescript
interface SourceAdapter {
  readonly id: string;            // Unique source key (e.g. 'fda-510k')
  readonly name: string;          // Human-readable name
  readonly description: string;   // What this source provides

  /**
   * Fetch new records from the source and return raw, unnormalized leads.
   * Should be idempotent — track last fetch timestamp internally.
   */
  fetch(): Promise<RawLead[]>;

  /**
   * Normalize a RawLead into a standardized LeadCandidate
   * that the orchestrator knows how to insert into Neo4j.
   */
  normalize(raw: RawLead): LeadCandidate;

  /**
   * Optional: validate that the source is reachable/configured
   */
  healthCheck(): Promise<boolean>;
}
```

### Data Shapes

```typescript
interface RawLead {
  sourceId: string;       // Source-specific ID (for dedup)
  sourceUrl?: string;     // Link back to the original record
  raw: Record<string, unknown>;  // Original source data, preserved
}

interface LeadCandidate {
  sourceId: string;
  companyName: string;
  domain?: string;
  description?: string;
  applicationAreas: string[];     // Diagnostic areas matched
  signals: Signal[];
  regulatoryStandards?: string[];
}

interface Signal {
  type: 'FDA_CLEARANCE' | 'CLINICAL_TRIAL' | 'PATENT' | 'HIRING' | 'FUNDING' | 'NEWS';
  date: string;
  description: string;
  confidence: number;   // 0-1
  url?: string;
}
```

## Data Sources (Adapters)

### 1. FDA 510(k) — Real Adapter

**What it is**: The FDA's Premarket Notification database. Any new diagnostic device cleared for sale in the US is here. Each record contains the submitter (company), device name, product code (e.g. `JPA` = hemostasis), and decision date.

**Implementation**:
- HTTP GET `https://accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm`
- Parse the HTML table (or use FDA's open API via `api.fda.gov/device/510k.json`)
- Filter by product codes relevant to biological intermediates:
  - `JPA` — Hemostasis/coagulation
  - `JSO` — Plasma proteins
  - `JXV` — Immunoassay reagents
  - `JJF` — Various diagnostic reagents
- Extract company name, map to Company node
- Create `DEVELOPS` relationship to Application node
- Create `HAS_SIGNAL` of type `FDA_CLEARANCE`

**Rate limiting**: Respect 1 req/sec. Cache results in local JSON for demo.

### 2. ClinicalTrials.gov — Stub Adapter

**What it is**: Registry of clinical studies. Companies running diagnostic trials for new assays need biological intermediates. Stub for the hackathon — return realistic simulated trial records showing companies actively developing new diagnostic assays.

### 3. Patent Filings — Stub

**Simulated data** showing companies that recently filed patents for novel diagnostic methods (IPC code `C12Q`). Each stub record shows company name, patent title, filing date, and the diagnostic application area inferred from the patent.

### 4. Job Postings — Stub

**Simulated data** from a LinkedIn/Indeed-like source showing companies hiring R&D Scientists, Assay Development Engineers, or Regulatory Affairs specialists with diagnostic experience. Hiring signals indicate growth and imminent need for raw materials.

### 5. Trade Show Exhibitors — Stub

**Simulated data** from MEDICA/Düsseldorf exhibitor lists, filtered to companies in the diagnostic reagents and assay development categories. Conference participation = active in the market.

### 6. Funding/Investment — Stub

**Simulated data** of diagnostics companies that recently raised funding, indicating budget available for raw material procurement.

## IngestionOrchestrator

The orchestrator manages the full pipeline:

```
┌─────────────────────────────────────────────────────┐
│                 IngestionOrchestrator                │
├─────────────────────────────────────────────────────┤
│                                                      │
│   For each registered SourceAdapter:                 │
│                                                      │
│   1. fetch() → RawLead[]                             │
│   2. normalize() → LeadCandidate[]                   │
│   3. deduplicate (by company name + sourceId)        │
│   4. For each LeadCandidate:                         │
│      a. MERGE Company node                           │
│      b. MERGE DEVELOPS relationships                 │
│      c. CREATE HAS_SIGNAL relationships              │
│      d. CREATE PATENT/TRIAL relationships            │
│   5. Return ingestion summary                        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Deduplication Strategy

- Company names are normalized (trim, lowercase, strip legal suffixes)
- Dedup key: `(companyName, sourceId)`
- If same company appears from multiple sources, merge signals under one Company node

### Idempotency

Each `SourceAdapter.fetch()` tracks its last run timestamp. On subsequent runs, it only returns records newer than the last fetch. The FDA adapter uses `decision_date` from the API response for this.

## API Endpoints

```
POST /api/graph/ingest
  Trigger all adapters (or specific: ?source=fda-510k)
  Returns: { summary: { sourceId: { fetched, created, failed }, total }

POST /api/graph/ingest/seed
  Seed the entire ontology with baseline data:
  - Diagnostic application areas
  - Product catalog (Siemens Healthineers products)
  - 20+ seeded competitor/supplier companies
  - Regulatory standard nodes
  Returns: count of nodes created
```

## Filesystem Layout

```
packages/server/src/services/graph/
├── ontology.ts              # Cypher schema + seed data
├── neo4j.ts                 # Driver connection (existing)
├── ingest/
│   ├── types.ts             # SourceAdapter interface, data shapes
│   ├── orchestrator.ts      # IngestionOrchestrator
│   ├── adapters/
│   │   ├── fda-510k.ts      # Real FDA adapter
│   │   ├── clinical-trials.ts # Stub: clinical trial activity
│   │   ├── patent-stub.ts   # Stub: patent filings
│   │   ├── hiring-stub.ts   # Stub: job postings
│   │   ├── conference-stub.ts # Stub: trade show exhibitors
│   │   └── funding-stub.ts  # Stub: investment data
│   └── index.ts             # Re-export for API routes
```

## Scoring Pipeline (Brief)

Not the focus of this spec, but ingestion feeds directly into scoring. Once a Company has `DEVELOPS` and `HAS_SIGNAL` edges, the scorer walks those relationships:

```
For each company without a SUPPLIES_TO relationship with Siemens:
  1. Product fit: count matching Products × Application overlap
  2. Signal strength: sum of weighted signal scores (recent signals higher)
  3. Segment bonus: IVD manufacturer > CDMO > Research > Other
  4. Return 0-100 priority score
```

## Key Design Decisions

1. **Plugin pattern** → Each adapter is independently testable. New sources added by implementing 3 methods.
2. **Adapters are server-side only** → No client-side API keys or scraping.
3. **Stubs are realistic** → Each stub returns data that *looks* like the real source, so the demo tells a coherent story.
4. **Seed-first, then ingest** → Ontology and baseline companies are seeded once. Ingest adds signals and new companies incrementally.

## Out of Scope (for this sprint)

- Real web scraping infrastructure (scheduler, retry, proxy rotation)
- Full HTML/PDF parsing (Docling integration for complex documents)
- Authentication/API key management UI
- Historical backfill beyond 2 years
- Streaming ingestion (real-time signal detection)
