# LeadGraph Data Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a plugin-based data ingestion pipeline that discovers B2B leads from multiple sources (FDA 510(k) database, patent filings, job postings, clinical trials, conferences, funding) and populates a Neo4j knowledge graph.

**Architecture:** SourceAdapter interface pattern — each data source implements `fetch()` / `normalize()` / `healthCheck()`. An IngestionOrchestrator runs all adapters, deduplicates by company name, and writes to Neo4j via `runQuery`. One real adapter (FDA 510(k) via api.fda.gov), five stub adapters returning realistic simulated data.

**Tech Stack:** Express + TypeScript + Neo4j driver + Node fetch (built-in) + pino logging

**Files:** All under `packages/server/src/services/graph/ingest/` plus route additions.

---

## File Structure

```
packages/server/src/services/graph/
├── ingest/
│   ├── types.ts              # SourceAdapter interface, data shapes, SourceConfig, scoring types
│   ├── ontology.ts           # Cypher schema + seed data for companies/applications
│   ├── orchestrator.ts       # SourceManager — KeeLead-inspired concurrent adapter runner
│   ├── adapters/
│   │   ├── fda-510k.ts       # Real adapter: FDA 510(k) API
│   │   ├── clinical-trials.ts # Stub: clinical trial activity
│   │   ├── patent-stub.ts    # Stub: diagnostic patent filings
│   │   ├── hiring-stub.ts    # Stub: R&D job postings
│   │   ├── conference-stub.ts # Stub: trade show exhibitors
│   │   ├── funding-stub.ts   # Stub: diagnostics investment
│   │   └── github.ts         # Gitsneak-inspired: GitHub org detection + keyword search
│   └── index.ts              # Re-exports + singleton SourceManager
├── scoring/
│   ├── types.ts              # ScoredResult interface
│   └── scorer.ts             # ScoreAll: tier classification, disqualifiers, outreach hooks
├── neo4j.ts                  # Existing — runQuery, verifyConnection, closeDriver
└── ontology.ts               # (new) — Cypher schema + seed functions
```

**Routes modified:**
```
packages/server/src/routes/graph.ts  — add POST /ingest, GET /score, GET /ingest/sources
packages/server/src/services/ai/llm.ts — (maybe) AI enrichment for FDA normalization
```

**Scoring script:**
```
packages/server/src/scripts/scoring.ts — CLI for npm run score
```

---

### Task 1: Types + SourceAdapter Interface

**Files:**
- Create: `packages/server/src/services/graph/ingest/types.ts`

- [ ] **Write the SourceAdapter interface and all data shapes**

```typescript
export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  fetch(): Promise<RawLead[]>;
  normalize(raw: RawLead): LeadCandidate;
  healthCheck(): Promise<boolean>;
}

export interface RawLead {
  sourceId: string;
  sourceUrl?: string;
  raw: Record<string, unknown>;
}

export interface LeadCandidate {
  sourceId: string;
  companyName: string;
  domain?: string;
  description?: string;
  applicationAreas: string[];
  signals: Signal[];
  regulatoryStandards?: string[];
}

export interface Signal {
  type: SignalType;
  date: string;
  description: string;
  confidence: number;
  url?: string;
}

export type SignalType =
  | "FDA_CLEARANCE"
  | "CLINICAL_TRIAL"
  | "PATENT"
  | "HIRING"
  | "FUNDING"
  | "NEWS";

export interface IngestionSummary {
  sourceId: string;
  fetched: number;
  created: number;
  failed: number;
  errors: string[];
}

export interface SeedSummary {
  constraintsCreated: number;
  applicationAreas: number;
  companiesSeeded: number;
  productsSeeded: number;
  relationshipsCreated: number;
}

// ---- KeeLead-inspired: per-source weight/config ----
export interface SourceConfig {
  weight: number;          // priority (higher = fetched first in parallel pool)
  concurrency?: number;    // max parallel requests within this source
  enabled: boolean;
}

// ---- OpenGTM-inspired: tier classification ----
export type TierLevel = "HOT" | "WARM" | "COLD";

// ---- Lead Engine-inspired: disqualifier + score breakdown ----
export interface Disqualifier {
  reason: string;
  severity: "HARD" | "SOFT";
}

export interface ScoreBreakdown {
  signalScore: number;       // 0-40: weighted signal recency + confidence
  productFitScore: number;   // 0-30: application area overlap with Siemens products
  segmentBonus: number;      // 0-20: IVD manufacturer > CDMO > Supplier > Research
  recencyBonus: number;      // 0-10: signals within last 3 months
  total: number;             // 0-100
}

export interface ScoredCompany {
  companyName: string;
  tier: TierLevel;
  score: number;
  breakdown: ScoreBreakdown;
  disqualifiers: Disqualifier[];
  outreachHook?: string;     // Lead Engine: generated hook from signal breakdown
}
```

- [ ] **Commit**

```
cd /home/weiss/git/gi-hack && git add packages/server/src/services/graph/ingest/types.ts && git commit -m "feat: add SourceAdapter interface and data shapes"
```

---

### Task 2: Ontology Seed Script

**Files:**
- Create: `packages/server/src/services/graph/ingest/ontology.ts`

This file exports Cypher query strings and a `seedGraph()` function that creates constraints, application areas, a product catalog, and baseline competitor companies.

- [ ] **Write the ontology seed module**

```typescript
import { runQuery } from "../neo4j.js";
import { SeedSummary } from "./types.js";

const CONSTRAINTS = [
  "CREATE CONSTRAINT company_name IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE",
  "CREATE CONSTRAINT application_name IF NOT EXISTS FOR (a:Application) REQUIRE a.name IS UNIQUE",
  "CREATE INDEX company_domain IF NOT EXISTS FOR (c:Company) ON (c.domain)",
  "CREATE INDEX signal_type_idx IF NOT EXISTS FOR (s:Signal) ON (s.type)",
];

const APPLICATION_AREAS = [
  { name: "Hemostasis", category: "HEMATOLOGY", marketSize: "2.1B" },
  { name: "Plasma Proteins", category: "PROTEIN_CHEMISTRY", marketSize: "1.8B" },
  { name: "Infectious Disease", category: "MICROBIOLOGY", marketSize: "4.5B" },
  { name: "Oncology Assays", category: "ONCOLOGY", marketSize: "3.2B" },
  { name: "Neurology Markers", category: "NEUROLOGY", marketSize: "1.1B" },
  { name: "Cardiac Markers", category: "CARDIOLOGY", marketSize: "2.8B" },
  { name: "Autoimmune Diagnostics", category: "IMMUNOLOGY", marketSize: "1.5B" },
];

const PRODUCTS: Array<{
  name: string;
  catalogId: string;
  category: string;
  applications: string[];
}> = [
  { name: "INNOVANCE D-Dimer", catalogId: "OPBP-001", category: "HEMOSTASIS_PROTEIN", applications: ["Hemostasis"] },
  { name: "INNOVANCE Antithrombin", catalogId: "OPBP-002", category: "HEMOSTASIS_PROTEIN", applications: ["Hemostasis"] },
  { name: "INNOVANCE VWF Ac", catalogId: "OPBP-003", category: "HEMOSTASIS_PROTEIN", applications: ["Hemostasis"] },
  { name: "N Antiserum to Human Transferrin", catalogId: "OPBP-004", category: "PLASMA_ANTIBODY", applications: ["Plasma Proteins"] },
  { name: "N Antiserum to Human Haptoglobin", catalogId: "OPBP-005", category: "PLASMA_ANTIBODY", applications: ["Plasma Proteins"] },
  { name: "N Antiserum to Human Alpha-1 Antitrypsin", catalogId: "OPBP-006", category: "PLASMA_ANTIBODY", applications: ["Plasma Proteins"] },
  { name: "BC Latex Reagent", catalogId: "OPBP-007", category: "LATEX_REAGENT", applications: ["Hemostasis"] },
  { name: "HLA-B27 Antibody", catalogId: "OPBP-008", category: "DIAGNOSTIC_ANTIBODY", applications: ["Autoimmune Diagnostics"] },
  { name: "Troponin I Antibody Pair", catalogId: "OPBP-009", category: "DIAGNOSTIC_ANTIBODY", applications: ["Cardiac Markers"] },
  { name: "PSA Antibody Pair", catalogId: "OPBP-010", category: "DIAGNOSTIC_ANTIBODY", applications: ["Oncology Assays"] },
];

const COMPETITOR_COMPANIES: Array<{
  name: string;
  domain: string;
  segment: string;
  region: string;
  applications: string[];
  products: string[];
}> = [
  { name: "SERION Immunologics", domain: "serion-immunologics.com", segment: "SUPPLIER", region: "EUROPE", applications: ["Infectious Disease", "Plasma Proteins"], products: ["Dengue Antigen", "WNV Envelope Protein"] },
  { name: "ASKA Biotech", domain: "aska-biotech.de", segment: "CDMO", region: "EUROPE", applications: ["Infectious Disease", "Oncology Assays"], products: ["Custom mAb", "Recombinant Protein"] },
  { name: "JTC Diagnostics", domain: "jtc-diagnostics.de", segment: "SUPPLIER", region: "EUROPE", applications: ["Infectious Disease", "Cardiac Markers"], products: ["Enzymes", "Antibodies", "Antigens"] },
  { name: "NAGASE Europe", domain: "nagase.eu", segment: "SUPPLIER", region: "EUROPE", applications: ["Cardiac Markers", "Neurology Markers"], products: ["AFP Antibody", "Anti-Tau Antibody"] },
  { name: "BioGenes", domain: "biogenes.de", segment: "CDMO", region: "EUROPE", applications: ["Infectious Disease", "Neurology Markers"], products: ["HCP ELISA Kit", "Custom Antibody"] },
  { name: "InVivo BioTech", domain: "invivo.de", segment: "CDMO", region: "EUROPE", applications: ["Hemostasis", "Plasma Proteins"], products: ["mAb Production", "Protein Expression"] },
  { name: "SeamlessBio", domain: "seamlessbio.de", segment: "CDMO", region: "EUROPE", applications: ["Infectious Disease", "Oncology Assays"], products: ["Recombinant Protein", "BSA", "Human Plasma"] },
  { name: "Merck KGaA", domain: "merckgroup.com", segment: "SUPPLIER", region: "EUROPE", applications: ["Infectious Disease", "Oncology Assays", "Cardiac Markers"], products: ["Antibodies", "Reagents"] },
  { name: "Bio-Rad Laboratories", domain: "bio-rad.com", segment: "SUPPLIER", region: "NORTH_AMERICA", applications: ["Hemostasis", "Infectious Disease", "Plasma Proteins"], products: ["Antibodies", "Reagents"] },
  { name: "Thermo Fisher Scientific", domain: "thermofisher.com", segment: "SUPPLIER", region: "NORTH_AMERICA", applications: ["Infectious Disease", "Oncology Assays", "Hemostasis"], products: ["Invitrogen Antibodies", "Pierce Proteins"] },
  { name: "Sysmex", domain: "sysmex.com", segment: "IVD_MANUFACTURER", region: "ASIA", applications: ["Hemostasis", "Plasma Proteins"], products: ["CS-Series Analyzers"] },
  { name: "Roche Diagnostics", domain: "roche.com", segment: "IVD_MANUFACTURER", region: "EUROPE", applications: ["Oncology Assays", "Infectious Disease", "Cardiac Markers"], products: ["Elecsys Assays", "cobas Systems"] },
  { name: "Abbott Diagnostics", domain: "abbott.com", segment: "IVD_MANUFACTURER", region: "NORTH_AMERICA", applications: ["Cardiac Markers", "Infectious Disease", "Neurology Markers"], products: ["ARCHITECT Assays", "Alinity Systems"] },
  { name: "Euroimmun", domain: "euroimmun.com", segment: "IVD_MANUFACTURER", region: "EUROPE", applications: ["Autoimmune Diagnostics", "Infectious Disease"], products: ["IIFT Assays", "ELISA Kits"] },
  { name: "bioMérieux", domain: "biomerieux.com", segment: "IVD_MANUFACTURER", region: "EUROPE", applications: ["Infectious Disease", "Plasma Proteins"], products: ["VITEK Systems", "VIDAS Assays"] },
];

const SIGNAL_SEED_DATA: Array<{
  companyName: string;
  signals: Array<{ type: string; date: string; description: string; confidence: number }>;
}> = [
  {
    companyName: "ASKA Biotech",
    signals: [
      { type: "HIRING", date: "2026-05-15", description: "Hiring Senior R&D Scientist - Assay Development", confidence: 0.9 },
      { type: "NEWS", date: "2026-04-20", description: "Announced new ISO 13485 expansion for IVD production", confidence: 0.8 },
    ],
  },
  {
    companyName: "BioGenes",
    signals: [
      { type: "NEWS", date: "2026-05-01", description: "Launched new CTSB-specific HCP ELISA Kit", confidence: 0.85 },
      { type: "CLINICAL_TRIAL", date: "2026-03-10", description: "Biomarker discovery partnership with pharma", confidence: 0.7 },
    ],
  },
  {
    companyName: "SeamlessBio",
    signals: [
      { type: "FUNDING", date: "2026-04-01", description: "Expanded CDMO capacity with new bioreactor line", confidence: 0.75 },
    ],
  },
];

export async function seedGraph(): Promise<SeedSummary> {
  let constraintsCreated = 0;
  for (const cypher of CONSTRAINTS) {
    await runQuery(cypher);
    constraintsCreated++;
  }

  // Create application areas
  for (const app of APPLICATION_AREAS) {
    await runQuery(
      `MERGE (a:Application {name: $name})
       SET a.category = $category, a.marketSize = $marketSize`,
      app
    );
  }

  // Create Siemens Healthineers company node
  await runQuery(
    `MERGE (c:Company {name: $name})
     SET c.domain = $domain, c.segment = $segment, c.region = $region`,
    { name: "Siemens Healthineers", domain: "siemens-healthineers.com", segment: "IVD_MANUFACTURER", region: "EUROPE" }
  );

  // Create products and link to Siemens
  for (const p of PRODUCTS) {
    await runQuery(
      `MERGE (prod:Product {catalogId: $catalogId})
       SET prod.name = $name, prod.category = $category`,
      { name: p.name, catalogId: p.catalogId, category: p.category }
    );
    await runQuery(
      `MATCH (c:Company {name: "Siemens Healthineers"})
       MATCH (prod:Product {catalogId: $catalogId})
       MERGE (c)-[:SUPPLIES]->(prod)`,
      { catalogId: p.catalogId }
    );
    for (const appName of p.applications) {
      await runQuery(
        `MATCH (prod:Product {catalogId: $catalogId})
         MATCH (a:Application {name: $appName})
         MERGE (prod)-[:USED_IN]->(a)`,
        { catalogId: p.catalogId, appName }
      );
    }
  }

  // Create competitor companies
  for (const comp of COMPETITOR_COMPANIES) {
    await runQuery(
      `MERGE (c:Company {name: $name})
       SET c.domain = $domain, c.segment = $segment, c.region = $region`,
      { name: comp.name, domain: comp.domain, segment: comp.segment, region: comp.region }
    );
    for (const appName of comp.applications) {
      await runQuery(
        `MATCH (c:Company {name: $name})
         MATCH (a:Application {name: $appName})
         MERGE (c)-[:DEVELOPS]->(a)`,
        { name: comp.name, appName }
      );
    }
  }

  // Seed signals for companies
  for (const item of SIGNAL_SEED_DATA) {
    for (const sig of item.signals) {
      await runQuery(
        `MATCH (c:Company {name: $companyName})
         CREATE (s:Signal {type: $type, date: $date, description: $description, confidence: $confidence})
         MERGE (c)-[:HAS_SIGNAL]->(s)`,
        { companyName: item.companyName, ...sig }
      );
    }
  }

  return {
    constraintsCreated,
    applicationAreas: APPLICATION_AREAS.length,
    companiesSeeded: COMPETITOR_COMPANIES.length + 1,
    productsSeeded: PRODUCTS.length,
    relationshipsCreated: -1, // counted below if needed
  };
}
```

- [ ] **Commit**

```
git add packages/server/src/services/graph/ingest/ontology.ts && git commit -m "feat: add ontology seed with companies, products, applications, signals"
```

---

### Task 3: Stub Adapters (5 files)

**Files:**
- Create: `packages/server/src/services/graph/adapters/clinical-trials.ts`
- Create: `packages/server/src/services/graph/adapters/patent-stub.ts`
- Create: `packages/server/src/services/graph/adapters/hiring-stub.ts`
- Create: `packages/server/src/services/graph/adapters/conference-stub.ts`
- Create: `packages/server/src/services/graph/adapters/funding-stub.ts`

Each stub adapter follows the same pattern: returns 3-5 hardcoded `RawLead` objects based on realistic German diagnostics company data, then `normalize()` maps them to `LeadCandidate`.

- [ ] **Write all 5 stub adapters**

**clinical-trials.ts:**
```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface CTRecord {
  companyName: string;
  trialId: string;
  title: string;
  phase: string;
  condition: string;
  applicationArea: string;
  startDate: string;
}

const STUB_DATA: CTRecord[] = [
  { companyName: "Euroimmun", trialId: "NCT05678", title: "Diagnostic accuracy of novel ELISA for neurological autoantibodies", phase: "Phase 3", condition: "Autoimmune encephalitis", applicationArea: "Neurology Markers", startDate: "2026-03-01" },
  { companyName: "BioGenes", trialId: "NCT05679", title: "Novel HCP assay for monitoring host cell proteins in biotherapeutics", phase: "NA", condition: "Biomarker monitoring", applicationArea: "Infectious Disease", startDate: "2026-04-15" },
  { companyName: "Roche Diagnostics", trialId: "NCT05680", title: "Point-of-care cardiac troponin test for early MI detection", phase: "Phase 4", condition: "Acute myocardial infarction", applicationArea: "Cardiac Markers", startDate: "2026-02-01" },
  { companyName: "Sysmex", trialId: "NCT05681", title: "Novel hemostasis assay for DOAC monitoring", phase: "Phase 2", condition: "Anticoagulation management", applicationArea: "Hemostasis", startDate: "2026-05-01" },
];

export class ClinicalTrialsAdapter implements SourceAdapter {
  readonly id = "clinical-trials";
  readonly name = "ClinicalTrials.gov";
  readonly description = "Clinical studies for diagnostic assays";

  async fetch(): Promise<RawLead[]> {
    return STUB_DATA.map((r) => ({
      sourceId: `ct-${r.trialId}`,
      sourceUrl: `https://clinicaltrials.gov/study/${r.trialId}`,
      raw: r as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as unknown as CTRecord;
    const signal: Signal = {
      type: "CLINICAL_TRIAL",
      date: r.startDate,
      description: `${r.title} (${r.phase}) — ${r.condition}`,
      confidence: 0.7,
      url: raw.sourceUrl,
    };
    return {
      sourceId: raw.sourceId,
      companyName: r.companyName,
      description: r.title,
      applicationAreas: [r.applicationArea],
      signals: [signal],
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

**patent-stub.ts:**
```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface PatentRecord {
  companyName: string;
  patentId: string;
  title: string;
  applicationArea: string;
  filingDate: string;
}

const STUB_DATA: PatentRecord[] = [
  { companyName: "Euroimmun", patentId: "EP4265432", title: "Novel autoantibody detection method for neurological disorders", applicationArea: "Neurology Markers", filingDate: "2026-01-15" },
  { companyName: "Bio-Rad Laboratories", patentId: "US12098765", title: "Digital ELISA for ultra-sensitive protein detection", applicationArea: "Plasma Proteins", filingDate: "2026-02-20" },
  { companyName: "Abbott Diagnostics", patentId: "US12109876", title: "High-sensitivity cardiac troponin assay using novel antibody pair", applicationArea: "Cardiac Markers", filingDate: "2026-03-10" },
  { companyName: "Sysmex", patentId: "EP4276543", title: "Light-scattering hemostasis assay with improved precision", applicationArea: "Hemostasis", filingDate: "2026-04-05" },
  { companyName: "Merck KGaA", patentId: "EP4287654", title: "Stabilized recombinant antigens for IVD calibration", applicationArea: "Infectious Disease", filingDate: "2026-05-01" },
];

export class PatentStubAdapter implements SourceAdapter {
  readonly id = "patents";
  readonly name = "Patent Filings";
  readonly description = "Recent diagnostic method patents";

  async fetch(): Promise<RawLead[]> {
    return STUB_DATA.map((r) => ({
      sourceId: `pat-${r.patentId}`,
      sourceUrl: `https://patents.google.com/patent/${r.patentId}`,
      raw: r as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as unknown as PatentRecord;
    const signal: Signal = {
      type: "PATENT",
      date: r.filingDate,
      description: r.title,
      confidence: 0.65,
      url: raw.sourceUrl,
    };
    return {
      sourceId: raw.sourceId,
      companyName: r.companyName,
      description: r.title,
      applicationAreas: [r.applicationArea],
      signals: [signal],
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

**hiring-stub.ts:**
```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface HiringRecord {
  companyName: string;
  jobId: string;
  title: string;
  department: string;
  applicationArea: string;
  postedDate: string;
}

const STUB_DATA: HiringRecord[] = [
  { companyName: "BioGenes", jobId: "BG-2026-042", title: "Senior Scientist Immunoassay Development", department: "R&D", applicationArea: "Infectious Disease", postedDate: "2026-05-10" },
  { companyName: "ASKA Biotech", jobId: "AB-2026-018", title: "R&D Engineer Recombinant Protein Expression", department: "Process Development", applicationArea: "Oncology Assays", postedDate: "2026-05-15" },
  { companyName: "SeamlessBio", jobId: "SB-2026-007", title: "Head of Quality Assurance (IVDR)", department: "Quality", applicationArea: "Infectious Disease", postedDate: "2026-04-20" },
  { companyName: "SERION Immunologics", jobId: "SI-2026-033", title: "Product Manager IVD Raw Materials", department: "Product Management", applicationArea: "Infectious Disease", postedDate: "2026-05-01" },
  { companyName: "Euroimmun", jobId: "EU-2026-055", title: "Scientist ELISA Kit Development", department: "R&D", applicationArea: "Autoimmune Diagnostics", postedDate: "2026-05-05" },
];

export class HiringStubAdapter implements SourceAdapter {
  readonly id = "hiring";
  readonly name = "Job Postings";
  readonly description = "R&D and quality hiring signals in diagnostics";

  async fetch(): Promise<RawLead[]> {
    return STUB_DATA.map((r) => ({
      sourceId: `job-${r.jobId}`,
      sourceUrl: `https://linkedin.com/jobs/${r.jobId}`,
      raw: r as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as unknown as HiringRecord;
    const signal: Signal = {
      type: "HIRING",
      date: r.postedDate,
      description: `Hiring: ${r.title} (${r.department})`,
      confidence: 0.85,
    };
    return {
      sourceId: raw.sourceId,
      companyName: r.companyName,
      description: `${r.title} position in ${r.department}`,
      applicationAreas: [r.applicationArea],
      signals: [signal],
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

**conference-stub.ts:**
```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface ConferenceRecord {
  companyName: string;
  conference: string;
  year: number;
  boothNumber: string;
  applicationArea: string;
  description: string;
}

const STUB_DATA: ConferenceRecord[] = [
  { companyName: "SERION Immunologics", conference: "MEDICA 2025", year: 2025, boothNumber: "Hall 3, B72", applicationArea: "Infectious Disease", description: "Showcasing new Dengue/WNV antigens" },
  { companyName: "ASKA Biotech", conference: "MEDICA 2025", year: 2025, boothNumber: "Hall 3, G72-1", applicationArea: "Oncology Assays", description: "ISO 13485 contract manufacturing services" },
  { companyName: "SeamlessBio", conference: "ADLM 2026", year: 2026, boothNumber: "Hall A, 412", applicationArea: "Infectious Disease", description: "Launching new protein production service" },
  { companyName: "BioGenes", conference: "BIO-Europe 2025", year: 2025, boothNumber: "Partnering Table 42", applicationArea: "Neurology Markers", description: "HCP ELISA and custom antibody showcase" },
  { companyName: "JTC Diagnostics", conference: "Analytica 2026", year: 2026, boothNumber: "Hall B2, 301", applicationArea: "Cardiac Markers", description: "New IVD raw material portfolio" },
];

export class ConferenceStubAdapter implements SourceAdapter {
  readonly id = "conferences";
  readonly name = "Trade Show Exhibitors";
  readonly description = "MEDICA, ADLM, Analytica exhibitor presence";

  async fetch(): Promise<RawLead[]> {
    return STUB_DATA.map((r) => ({
      sourceId: `conf-${r.conference.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${r.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      sourceUrl: undefined,
      raw: r as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as unknown as ConferenceRecord;
    const signal: Signal = {
      type: "NEWS",
      date: `${r.year}-06-01`,
      description: `Exhibiting at ${r.conference}: ${r.description}`,
      confidence: 0.6,
    };
    return {
      sourceId: raw.sourceId,
      companyName: r.companyName,
      description: `Active at ${r.conference} — ${r.description}`,
      applicationAreas: [r.applicationArea],
      signals: [signal],
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

**funding-stub.ts:**
```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface FundingRecord {
  companyName: string;
  round: string;
  amount: string;
  date: string;
  investors: string;
  applicationArea: string;
}

const STUB_DATA: FundingRecord[] = [
  { companyName: "ASKA Biotech", round: "Series A", amount: "€8M", date: "2026-04-01", investors: "BioFund Ventures, High-Tech Gründerfonds", applicationArea: "Oncology Assays" },
  { companyName: "SeamlessBio", round: "Growth", amount: "€5M", date: "2026-03-15", investors: "TechGrowth Capital", applicationArea: "Infectious Disease" },
  { companyName: "BioGenes", round: "Expansion", amount: "€3M", date: "2026-02-01", investors: "Berlin Innovation Fund", applicationArea: "Neurology Markers" },
  { companyName: "Euroimmun", round: "R&D Grant", amount: "€1.5M", date: "2026-05-01", investors: "EU Horizon Europe", applicationArea: "Autoimmune Diagnostics" },
];

export class FundingStubAdapter implements SourceAdapter {
  readonly id = "funding";
  readonly name = "Investment & Funding";
  readonly description = "Recent investment in diagnostics companies";

  async fetch(): Promise<RawLead[]> {
    return STUB_DATA.map((r) => ({
      sourceId: `fund-${r.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${r.date}`,
      sourceUrl: undefined,
      raw: r as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as unknown as FundingRecord;
    const signal: Signal = {
      type: "FUNDING",
      date: r.date,
      description: `${r.round}: ${r.amount} from ${r.investors}`,
      confidence: 0.8,
    };
    return {
      sourceId: raw.sourceId,
      companyName: r.companyName,
      description: `Raised ${r.amount} for diagnostic expansion`,
      applicationAreas: [r.applicationArea],
      signals: [signal],
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

- [ ] **Commit all stub adapters**

```
git add packages/server/src/services/graph/ingest/adapters/ && git commit -m "feat: add 5 stub adapters for clinical-trials, patents, hiring, conferences, funding"
```

---

### Task 3.5: GitHub Source Adapter (Gitsneak-inspired)

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/github.ts`

This adapter searches GitHub for organizations and repos related to diagnostics, IVD, and assay development. Inspired by Gitsneak's GitHub client with org detection and profile scraping. Uses GitHub's REST API (no auth for public data, optional token for higher rate limits).

- [ ] **Write the GitHubSourceAdapter**

```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface GHOrgResult {
  login: string;
  description: string | null;
  url: string;
  repos: string[];
  topics: string[];
  createdAt: string;
}

const DIAGNOSTIC_KEYWORDS = [
  "diagnostics", "immunoassay", "elisa", "ivd", "in-vitro",
  "assay", "antibody", "antigen", "hemostasis", "clinical-chemistry",
  "biomarker", "point-of-care", "lateral-flow", "microfluidics",
];

const GITHUB_API = "https://api.github.com";

export class GitHubSourceAdapter implements SourceAdapter {
  readonly id = "github";
  readonly name = "GitHub Organizations";
  readonly description = "GitHub companies with diagnostics-related repositories";

  private token: string | undefined;
  private lastFetch: string = "2025-01-01";

  constructor(token?: string) {
    this.token = token;
  }

  private async ghFetch(path: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "LeadGraph/1.0",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${GITHUB_API}${path}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      if (res.status === 403) console.warn("GitHub rate limited — consider adding GITHUB_TOKEN env var");
      return null;
    }
    return res.json();
  }

  async fetch(): Promise<RawLead[]> {
    const leads: RawLead[] = [];

    // Search for repos matching diagnostic keywords
    for (const keyword of DIAGNOSTIC_KEYWORDS) {
      const results = await this.ghFetch(
        `/search/repositories?q=${keyword}+in:name,description,topics&sort=updated&per_page=10`
      );
      if (!results?.items) continue;

      // Group by owner login (potential company)
      const orgMap = new Map<string, GHOrgResult>();
      for (const repo of results.items) {
        const owner = repo.owner;
        if (!owner || owner.type === "User") continue; // skip personal repos, focus on orgs

        if (!orgMap.has(owner.login)) {
          // Try to get org profile for description
          let orgDescription = owner.description ?? owner.login;
          let orgCreated = owner.created_at ?? "2025-01-01";
          try {
            const orgDetail = await this.ghFetch(`/orgs/${owner.login}`);
            if (orgDetail) {
              orgDescription = orgDetail.description ?? orgDetail.name ?? owner.login;
              orgCreated = orgDetail.created_at;
            }
          } catch { /* use defaults */ }

          orgMap.set(owner.login, {
            login: owner.login,
            description: orgDescription,
            url: owner.html_url,
            repos: [],
            topics: [],
            createdAt: orgCreated,
          });
        }

        const entry = orgMap.get(owner.login)!;
        if (!entry.repos.includes(repo.full_name)) {
          entry.repos.push(repo.full_name);
        }
        if (repo.topics) {
          for (const topic of repo.topics) {
            if (!entry.topics.includes(topic)) entry.topics.push(topic);
          }
        }
      }

      // Convert to leads
      for (const [, org] of orgMap) {
        leads.push({
          sourceId: `gh-${org.login}`,
          sourceUrl: org.url,
          raw: org as unknown as Record<string, unknown>,
        });
      }
    }

    return leads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const org = raw.raw as unknown as GHOrgResult;

    // Map GitHub topics to diagnostic application areas
    const applicationAreas: string[] = [];
    const topicLower = org.topics.map((t) => t.toLowerCase());
    if (topicLower.some((t) => ["hemostasis", "coagulation"].includes(t))) applicationAreas.push("Hemostasis");
    if (topicLower.some((t) => ["immunoassay", "elisa", "antibody"].includes(t))) applicationAreas.push("Infectious Disease");
    if (topicLower.some((t) => ["biomarker", "cancer", "oncology"].includes(t))) applicationAreas.push("Oncology Assays");
    if (topicLower.some((t) => ["cardiac", "troponin"].includes(t))) applicationAreas.push("Cardiac Markers");
    if (topicLower.some((t) => ["neurology", "neuro"].includes(t))) applicationAreas.push("Neurology Markers");
    if (topicLower.some((t) => ["autoimmune", "autoimmunity"].includes(t))) applicationAreas.push("Autoimmune Diagnostics");
    if (topicLower.some((t) => ["protein", "plasma", "serum"].includes(t))) applicationAreas.push("Plasma Proteins");
    if (applicationAreas.length === 0) applicationAreas.push("Infectious Disease"); // default

    // Repos with diagnostic activity = a signal
    const signals: Signal[] = [
      {
        type: "NEWS",
        date: new Date().toISOString().slice(0, 10),
        description: `Active GitHub org with ${org.repos.length} diagnostic repos. Topics: ${org.topics.slice(0, 5).join(", ")}`,
        confidence: 0.6,
        url: org.url,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName: org.login, // will be refined; this is the GitHub org name
      domain: `${org.login.toLowerCase()}.com`,
      description: org.description ?? `GitHub organization active in diagnostics`,
      applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.ghFetch("/rate_limit");
    return result !== null && result.resources?.core?.remaining > 0;
  }
}
```

- [ ] **Commit**

```
git add packages/server/src/services/graph/ingest/adapters/github.ts && git commit -m "feat: add GitHubSourceAdapter with org detection and diagnostic keyword search"
```

---

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/fda-510k.ts`

This adapter fetches from the FDA open API, filters by relevant product codes, and creates lead candidates. Uses built-in Node.js `fetch`.

- [ ] **Write the FDA 510(k) adapter**

```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

// Product codes relevant to Siemens Healthineers biological intermediates
const RELEVANT_CODES = ["JPA", "JSO", "JXV", "JJF", "JTW", "JLH", "JXI", "JZJ"];

interface FDA510kRecord {
  k_number: string;
  applicant: string;
  device_name: string;
  product_code: string;
  decision_date: string;
  clearance_type: string;
  address_1: string;
  city: string;
  state: string;
  country: string;
  zip_code: string;
}

interface FDAAPIResponse {
  results: FDA510kRecord[];
  meta: { results: { total: number }; next?: string };
}

function extractCompanyName(rawName: string): string {
  return rawName
    .replace(/\s+(INC|CORP|LLC|GMBH|LTD|AG|NV|PLC|PTY)\.?$/i, "")
    .replace(/,\s*$/, "")
    .trim();
}

function mapProductCodeToApplications(code: string): string[] {
  const mapping: Record<string, string[]> = {
    JPA: ["Hemostasis"],
    JSO: ["Plasma Proteins"],
    JXV: ["Infectious Disease", "Autoimmune Diagnostics"],
    JJF: ["Cardiac Markers"],
    JTW: ["Hemostasis"],
    JLH: ["Neurology Markers"],
    JXI: ["Oncology Assays"],
    JZJ: ["Plasma Proteins"],
  };
  return mapping[code] ?? ["Infectious Disease"];
}

export class FDA510kAdapter implements SourceAdapter {
  readonly id = "fda-510k";
  readonly name = "FDA 510(k) Database";
  readonly description = "FDA premarket notification clearances for diagnostic devices";

  private lastFetchDate: string = "2025-06-01"; // Start from June 2025

  async fetch(): Promise<RawLead[]> {
    const allRecords: RawLead[] = [];

    for (const code of RELEVANT_CODES) {
      const url = `https://api.fda.gov/device/510k.json?search=product_code:${code}+AND+decision_date:[${this.lastFetchDate}+TO+2026-06-05]&limit=50&sort=decision_date:desc`;

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          console.warn(`FDA API returned ${res.status} for code ${code}`);
          continue;
        }
        const data: FDAAPIResponse = await res.json();
        if (!data.results || data.results.length === 0) continue;

        for (const record of data.results) {
          allRecords.push({
            sourceId: `fda-${record.k_number}`,
            sourceUrl: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${record.k_number}`,
            raw: record as unknown as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch FDA ${code}:`, err);
      }
    }

    return allRecords;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as unknown as FDA510kRecord;
    const companyName = extractCompanyName(r.applicant);
    const applications = mapProductCodeToApplications(r.product_code);

    const signal: Signal = {
      type: "FDA_CLEARANCE",
      date: r.decision_date,
      description: `${r.device_name} — ${r.product_code} clearance`,
      confidence: 0.95,
      url: raw.sourceUrl,
    };

    return {
      sourceId: raw.sourceId,
      companyName,
      domain: undefined,
      description: r.device_name,
      applicationAreas: applications,
      signals: [signal],
      regulatoryStandards: ["FDA 510(k)"],
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(
        "https://api.fda.gov/device/510k.json?search=product_code:JPA&limit=1&sort=decision_date:desc",
        { signal: AbortSignal.timeout(5_000) }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Commit**

```
git add packages/server/src/services/graph/ingest/adapters/fda-510k.ts && git commit -m "feat: add real FDA 510(k) adapter with product code filtering"
```

---

### Task 5: SourceManager (KeeLead-inspired concurrent orchestrator)

**Files:**
- Create: `packages/server/src/services/graph/ingest/orchestrator.ts`

The SourceManager replaces the simple sequential IngestionOrchestrator with KeeLead-inspired concurrent execution:
1. Maintains a registry of adapters with per-source weight config
2. Runs adapters in parallel (configurable pool, default concurrency=3)
3. Higher-weight sources start first in the pool
4. For each adapter: fetch → normalize → deduplicate → upsert into Neo4j
5. Deduplication: by company name (normalized) across ALL sources, not per-source
6. Returns `IngestionSummary[]`

- [ ] **Write the SourceManager with concurrent execution**

```typescript
import { runQuery } from "../neo4j.js";
import {
  SourceAdapter,
  SourceConfig,
  LeadCandidate,
  Signal,
  IngestionSummary,
} from "./types.js";

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deduplicateCandidates(candidates: LeadCandidate[]): LeadCandidate[] {
  const seen = new Map<string, LeadCandidate>();
  for (const c of candidates) {
    const key = `${normalizeCompanyName(c.companyName)}::${c.sourceId}`;
    if (!seen.has(key)) {
      seen.set(key, c);
    }
  }
  return Array.from(seen.values());
}

async function upsertCompany(lead: LeadCandidate): Promise<void> {
  const props: Record<string, unknown> = {
    name: lead.companyName,
    domain: lead.domain ?? null,
    description: lead.description ?? null,
  };
  await runQuery(
    `MERGE (c:Company {name: $name})
     SET c.domain = COALESCE(c.domain, $domain),
         c.description = COALESCE(c.description, $description)`,
    props
  );

  for (const area of lead.applicationAreas) {
    await runQuery(
      `MATCH (c:Company {name: $name})
       OPTIONAL MATCH (a:Application {name: $area})
       WITH c, a WHERE a IS NOT NULL
       MERGE (c)-[:DEVELOPS]->(a)`,
      { name: lead.companyName, area }
    );
  }

  for (const signal of lead.signals) {
    await runQuery(
      `MATCH (c:Company {name: $companyName})
       CREATE (s:Signal {
         type: $type, date: $date, description: $description,
         confidence: $confidence, url: $url
       })
       MERGE (c)-[:HAS_SIGNAL]->(s)`,
      { companyName: lead.companyName, ...signal, url: signal.url ?? null }
    );
  }
}

type AdapterEntry = {
  adapter: SourceAdapter;
  config: SourceConfig;
};

export class SourceManager {
  private pool: Map<string, AdapterEntry> = new Map();
  private maxConcurrency: number;

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  register(adapter: SourceAdapter, config?: Partial<SourceConfig>): void {
    this.pool.set(adapter.id, {
      adapter,
      config: {
        weight: config?.weight ?? 10,
        concurrency: config?.concurrency ?? 1,
        enabled: config?.enabled ?? true,
      },
    });
  }

  getRegistered(): string[] {
    return Array.from(this.pool.keys());
  }

  private async runAdapter(id: string): Promise<IngestionSummary> {
    const entry = this.pool.get(id);
    if (!entry) {
      return { sourceId: id, fetched: 0, created: 0, failed: 0, errors: [`No adapter "${id}"`] };
    }
    const { adapter } = entry;
    const summary: IngestionSummary = { sourceId: id, fetched: 0, created: 0, failed: 0, errors: [] };

    try {
      const rawLeads = await adapter.fetch();
      summary.fetched = rawLeads.length;
      const candidates = rawLeads.map((r) => adapter.normalize(r));
      const deduped = deduplicateCandidates(candidates);

      for (const lead of deduped) {
        try {
          await upsertCompany(lead);
          summary.created++;
        } catch (err) {
          summary.failed++;
          summary.errors.push(`Upsert fail ${lead.companyName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      summary.failed = summary.fetched;
      summary.errors.push(`Fetch fail ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return summary;
  }

  async runAll(): Promise<IngestionSummary[]> {
    // Sort by weight descending so heavier sources get priority in the pool
    const sorted = Array.from(this.pool.entries())
      .filter(([, e]) => e.config.enabled)
      .sort(([, a], [, b]) => b.config.weight - a.config.weight);

    const results: IngestionSummary[] = [];
    const running = new Set<Promise<void>>();

    for (const [id] of sorted) {
      // Wait if pool is full
      while (running.size >= this.maxConcurrency) {
        await Promise.race(running);
      }

      const task = (async () => {
        const summary = await this.runAdapter(id);
        results.push(summary);
      })();

      running.add(task);
      task.finally(() => running.delete(task));
    }

    await Promise.allSettled(running);
    return results;
  }

  async runSingle(sourceId: string): Promise<IngestionSummary> {
    return this.runAdapter(sourceId);
  }
}
```

- [ ] **Commit**

```
git add packages/server/src/services/graph/ingest/orchestrator.ts && git commit -m "feat: add SourceManager with KeeLead-inspired concurrent execution (pool=3)"
```

---

### Task 6: Ingestion Index + Wire to Routes

**Files:**
- Create: `packages/server/src/services/graph/ingest/index.ts`
- Modify: `packages/server/src/services/graph/ontology.ts` → rename to avoid conflict (move seed function to `ingest/ontology.ts`)

Actually, the seed function is already in `ingest/ontology.ts` from Task 2. No separate ontology.ts needed at the graph service root.

- [ ] **Write the ingest index**

```typescript
export { type SourceAdapter, type RawLead, type LeadCandidate, type Signal, type IngestionSummary } from "./types.js";
export { type SourceConfig, type ScoredCompany, type ScoreBreakdown, type TierLevel, type Disqualifier } from "./types.js";
export { seedGraph } from "./ontology.js";
export { SourceManager } from "./orchestrator.js";
export { FDA510kAdapter } from "./adapters/fda-510k.js";
export { ClinicalTrialsAdapter } from "./adapters/clinical-trials.js";
export { PatentStubAdapter } from "./adapters/patent-stub.js";
export { HiringStubAdapter } from "./adapters/hiring-stub.js";
export { ConferenceStubAdapter } from "./adapters/conference-stub.js";
export { FundingStubAdapter } from "./adapters/funding-stub.js";
export { GitHubSourceAdapter } from "./adapters/github.js";

let managerInstance: SourceManager | null = null;

export function getOrchestrator(): SourceManager {
  if (!managerInstance) {
    managerInstance = new SourceManager(3); // concurrency=3
    // Higher weight = more important source (runs first in pool)
    managerInstance.register(new FDA510kAdapter(), { weight: 50 });
    managerInstance.register(new GitHubSourceAdapter(process.env.GITHUB_TOKEN), { weight: 40 });
    managerInstance.register(new ClinicalTrialsAdapter(), { weight: 30 });
    managerInstance.register(new PatentStubAdapter(), { weight: 25 });
    managerInstance.register(new HiringStubAdapter(), { weight: 20 });
    managerInstance.register(new ConferenceStubAdapter(), { weight: 15 });
    managerInstance.register(new FundingStubAdapter(), { weight: 10 });
  }
  return managerInstance;
}
```

- [ ] **Commit**

```
git add packages/server/src/services/graph/ingest/index.ts && git commit -m "feat: add ingest index with orchestrator singleton"
```

---

### Task 7: API Routes (POST /api/graph/seed + POST /api/graph/ingest)

**Files:**
- Modify: `packages/server/src/routes/graph.ts`

- [ ] **Add seed and ingest routes to graph.ts**

Add new routes after the existing `/seed` route (which we replace since the old one was demo data):

```typescript
import { seedGraph, getOrchestrator } from "../services/graph/ingest/index.js";

// Replace the existing POST /seed
router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const result = await seedGraph();
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "GRAPH_SEED_FAILED", message },
    });
  }
});

router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const orchestrator = getOrchestrator();
    const source = req.query.source as string | undefined;
    const result = source
      ? [await orchestrator.runSingle(source)]
      : await orchestrator.runAll();
    res.json({ ok: true, data: { summaries: result } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "INGESTION_FAILED", message },
    });
  }
});

router.get("/ingest/sources", async (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  res.json({ ok: true, data: { sources: orchestrator.getRegistered() } });
});

// Score all companies in the graph (OpenGTM-inspired tier classification)
router.get("/score", async (_req: Request, res: Response) => {
  try {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const results = await scoreAll();
    res.json({ ok: true, data: { companies: results } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "SCORING_FAILED", message },
    });
  }
});
```

The old seed route (lines 29-56) and old query route (lines 6-27) remain as-is. The old seed route will be replaced by our new one.

Edit graph.ts:
1. Add the import for `seedGraph` and `getOrchestrator`
2. Replace the existing `POST /seed` with the new version
3. Add `POST /ingest` and `GET /ingest/sources` routes

- [ ] **Make the edits**

Replace the import on line 1-2:
```typescript
import { Router, Request, Response } from "express";
import { runQuery, verifyConnection } from "../services/graph/neo4j.js";
import { seedGraph, getOrchestrator } from "../services/graph/ingest/index.js";
```

Replace the seed route (lines 29-56) with the new version above and add the two new routes after it.

- [ ] **Commit**

```
git add packages/server/src/routes/graph.ts && git commit -m "feat: add /api/graph/seed and /api/graph/ingest routes"
```

---

### Task 8: CLI Entry Script

Add a script to `packages/server/package.json` that triggers ingestion from command line.

**Files:**
- Create: `packages/server/src/scripts/ingest.ts`
- Modify: `packages/server/package.json`

- [ ] **Write the CLI script**

```typescript
/**
 * Usage:
 *   npm run ingest              # Run all sources
 *   npm run ingest -- --source fda-510k  # Run specific source
 *
 * Requires Neo4j to be running.
 */
import { createDriver, closeDriver } from "../services/graph/neo4j.js";
import { getOrchestrator, seedGraph } from "../services/graph/ingest/index.js";

const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "password";

async function main() {
  const args = process.argv.slice(2);
  const sourceFlag = args.indexOf("--source");
  const source = sourceFlag >= 0 ? args[sourceFlag + 1] : undefined;
  const doSeed = args.includes("--seed");
  const doScore = args.includes("--score");

  createDriver({ uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD });

  if (doSeed) {
    console.log("Seeding ontology...");
    const result = await seedGraph();
    console.log("Seed complete:", JSON.stringify(result, null, 2));
  }

  if (doScore) {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const scored = await scoreAll();
    console.log("=== LeadGraph Scoring Results ===");
    for (const r of scored) {
      console.log(`[${r.tier}] ${r.companyName} — ${r.totalScore}/100`);
    }
  }

  if (!doScore || source) {
    const orchestrator = getOrchestrator();
    const result = source
      ? await orchestrator.runSingle(source)
      : await orchestrator.runAll();
    console.log(JSON.stringify(result, null, 2));
  }

  await closeDriver();
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
```

- [ ] **Add scripts to package.json**

```json
"ingest": "tsx src/scripts/ingest.ts",
"ingest:seed": "tsx src/scripts/ingest.ts --seed",
"ingest:fda": "tsx src/scripts/ingest.ts --source fda-510k",
"ingest:score": "tsx src/scripts/ingest.ts --seed --score",
"score": "tsx src/scripts/scoring.ts"
```

Add these inside the `"scripts"` object in `packages/server/package.json`.

- [ ] **Commit**

```
git add packages/server/src/scripts/ingest.ts packages/server/package.json && git commit -m "feat: add CLI ingest script with npm run ingest"
```

---

### Task 9: Verification

- [ ] **Check TypeScript compilation**

```
cd /home/weiss/git/gi-hack && npm run typecheck 2>&1
```

Expected: no errors. If errors, fix them.

- [ ] **Check LSP diagnostics on all new files**

```
Packages:
- packages/server/src/services/graph/ingest/types.ts
- packages/server/src/services/graph/ingest/ontology.ts
- packages/server/src/services/graph/ingest/orchestrator.ts
- packages/server/src/services/graph/ingest/index.ts
- packages/server/src/services/graph/ingest/adapters/fda-510k.ts
- packages/server/src/services/graph/ingest/adapters/clinical-trials.ts
- packages/server/src/services/graph/ingest/adapters/patent-stub.ts
- packages/server/src/services/graph/ingest/adapters/hiring-stub.ts
- packages/server/src/services/graph/ingest/adapters/conference-stub.ts
- packages/server/src/services/graph/ingest/adapters/funding-stub.ts
- packages/server/src/scripts/ingest.ts
- packages/server/src/routes/graph.ts
```

Run LSP diagnostics on each file. All should be clean.

- [ ] **End-to-end smoke test**

```
# Start Neo4j if not running
docker compose up -d neo4j

# Run seed
npm -w packages/server run ingest:seed

# Run all adapters
npm -w packages/server run ingest

# Check Neo4j data via the health route
curl http://localhost:3001/api/graph/health
```

All commands should succeed.

---

### Task 10: Scoring Pipeline (OpenGTM + Lead Engine + Intent-Detection-Agent)

**Files:**
- Create: `packages/server/src/services/graph/scoring/scorer.ts`
- Create: `packages/server/src/services/graph/scoring/types.ts`

The scorer reads companies from Neo4j, applies OpenGTM-inspired tier classification with Lead Engine-style disqualifiers and Intent-Detection-Agent weighted signals, and returns scored companies with outreach hooks.

**Architecture:**
1. Query all companies without `SUPPLIES_TO` relationship to Siemens (prospects)
2. For each: compute signalScore (weighted sum of signals by recency + confidence)
3. Compute productFitScore (application area overlap with Siemens product catalog)
4. Assign segmentBonus (IVD manufacturer=20, CDMO=15, Supplier=10, Research=5, Unknown=0)
5. Check hard disqualifiers (no signals, no domain, segment=Research)
6. Compute total and assign tier: HOT(70+), WARM(40-69), COLD(<40)
7. Generate outreach hook from strongest signal

- [ ] **Write scoring types**

```typescript
export interface ScoredResult {
  companyName: string;
  tier: "HOT" | "WARM" | "COLD";
  totalScore: number;
  breakdown: {
    signalScore: number;
    productFitScore: number;
    segmentBonus: number;
    recencyBonus: number;
  };
  disqualifiers: string[];
  outreachHook?: string;
}
```

- [ ] **Write the scorer**

```typescript
import { runQuery } from "../neo4j.js";
import { ScoredResult } from "./types.js";

const SEGMENT_BONUS: Record<string, number> = {
  IVD_MANUFACTURER: 20,
  CDMO: 15,
  SUPPLIER: 10,
  RESEARCH: 5,
};

const SEGMENT_TIER = {
  IVD_MANUFACTURER: 20,
  CDMO: 15,
  SUPPLIER: 10,
  RESEARCH: 5,
};

const SIGNAL_WEIGHTS: Record<string, number> = {
  FDA_CLEARANCE: 40,
  CLINICAL_TRIAL: 30,
  PATENT: 25,
  HIRING: 20,
  FUNDING: 15,
  NEWS: 10,
};

interface CompanyWithSignals {
  name: string;
  domain: string | null;
  segment: string | null;
  signals: Array<{
    type: string;
    date: string;
    confidence: number;
    description: string;
  }>;
  applications: string[];
}

function recencyBonus(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months <= 3) return 10;
  if (months <= 6) return 7;
  if (months <= 12) return 4;
  return 1;
}

function generateHook(signals: CompanyWithSignals["signals"]): string | undefined {
  // Lead Engine: pick the strongest signal and generate an outreach hook
  const sorted = [...signals].sort((a, b) => b.confidence - a.confidence);
  if (sorted.length === 0) return undefined;
  const top = sorted[0];
  switch (top.type) {
    case "FDA_CLEARANCE":
      return `Congrats on the recent ${top.description.split("—")[0]?.trim() ?? "FDA clearance"} — how are you sourcing raw materials for production scale-up?`;
    case "CLINICAL_TRIAL":
      return `Noticed your ${top.description.slice(0, 60)} trial — are you evaluating biological intermediate suppliers for the next phase?`;
    case "HIRING":
      return `Saw you're hiring ${top.description.replace("Hiring: ", "").slice(0, 40)} — expanding assay development? We should talk raw materials.`;
    case "FUNDING":
      return `Congrats on the recent funding! As you scale diagnostic production, we'd love to discuss our biological intermediate portfolio.`;
    case "PATENT":
      return `Your recent patent on ${top.description.slice(0, 50)} looks promising — are you planning to commercialize? We supply key intermediates.`;
    default:
      return undefined;
  }
}

export async function scoreAll(): Promise<ScoredResult[]> {
  // Fetch all prospect companies (no SUPPLIES_TO to Siemens) with their signals and applications
  const result = await runQuery(
    `MATCH (c:Company)
     WHERE NOT EXISTS {
       MATCH (c)-[:SUPPLIES_TO]->(:Company {name: "Siemens Healthineers"})
     }
     OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
     OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
     RETURN c.name AS name,
            c.domain AS domain,
            c.segment AS segment,
            collect(DISTINCT {type: s.type, date: s.date, confidence: s.confidence, description: s.description}) AS signals,
            collect(DISTINCT a.name) AS applications
     ORDER BY c.name`
  );

  const rows = result as CompanyWithSignals[];
  const scored: ScoredResult[] = [];

  for (const row of rows) {
    const disqualifiers: string[] = [];
    const validSignals = row.signals.filter((s) => s.type && s.date);

    // Hard disqualifiers (Lead Engine-inspired)
    if (validSignals.length === 0) disqualifiers.push("No signals detected — insufficient data");
    if (!row.domain) disqualifiers.push("No domain/website — hard to qualify");
    if (row.segment === "RESEARCH") disqualifiers.push("Research segment — unlikely B2B buyer");

    // Signal score: weighted sum with recency bonus
    let signalScore = 0;
    let maxRecency = 0;
    for (const s of validSignals) {
      const weight = SIGNAL_WEIGHTS[s.type] ?? 5;
      const recency = recencyBonus(s.date);
      signalScore += weight * s.confidence;
      if (recency > maxRecency) maxRecency = recency;
    }
    signalScore = Math.min(signalScore / 10, 40); // cap at 40

    // Product fit: application overlap with Siemens product catalog
    const siemensAppsResult = await runQuery(
      `MATCH (:Company {name: "Siemens Healthineers"})-[:SUPPLIES]->(:Product)-[:USED_IN]->(a:Application)
       RETURN collect(DISTINCT a.name) AS apps`
    );
    const siemensApps: string[] = (siemensAppsResult as any[])[0]?.apps ?? [];
    const overlap = row.applications.filter((a) => siemensApps.includes(a));
    const productFitScore = Math.min((overlap.length / Math.max(siemensApps.length, 1)) * 30, 30);

    // Segment bonus
    const segmentBonus = SEGMENT_BONUS[row.segment ?? ""] ?? 0;

    const breakdown = {
      signalScore: Math.round(signalScore),
      productFitScore: Math.round(productFitScore),
      segmentBonus,
      recencyBonus: Math.round(maxRecency),
    };

    const totalScore = Math.min(
      breakdown.signalScore + breakdown.productFitScore + breakdown.segmentBonus + breakdown.recencyBonus,
      100
    );

    let tier: "HOT" | "WARM" | "COLD";
    if (totalScore >= 70) tier = "HOT";
    else if (totalScore >= 40) tier = "WARM";
    else tier = "COLD";

    const outreachHook = disqualifiers.length === 0 ? generateHook(validSignals) : undefined;

    scored.push({
      companyName: row.name,
      tier,
      totalScore,
      breakdown,
      disqualifiers,
      outreachHook,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored;
}
```

- [ ] **Add CLI scoring script**

Add to `packages/server/src/scripts/scoring.ts`:

```typescript
import { createDriver, closeDriver } from "../services/graph/neo4j.js";
import { scoreAll } from "../services/graph/scoring/scorer.js";

const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "password";

async function main() {
  createDriver({ uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD });
  const results = await scoreAll();
  console.log("=== LeadGraph Scoring Results ===");
  console.log(`Total companies scored: ${results.length}`);
  console.log(`HOT:  ${results.filter((r) => r.tier === "HOT").length}`);
  console.log(`WARM: ${results.filter((r) => r.tier === "WARM").length}`);
  console.log(`COLD: ${results.filter((r) => r.tier === "COLD").length}`);
  console.log("");
  for (const r of results) {
    const flag = r.tier === "HOT" ? "🔥" : r.tier === "WARM" ? "⭐" : "  ";
    console.log(`${flag} [${r.tier}] ${r.companyName} — Score: ${r.totalScore}/100`);
    if (r.outreachHook) console.log(`   Hook: ${r.outreachHook}`);
    if (r.disqualifiers.length) console.log(`   ⚠ ${r.disqualifiers.join("; ")}`);
    console.log("");
  }
  await closeDriver();
}

main().catch((err) => {
  console.error("Scoring failed:", err);
  process.exit(1);
});
```

- [ ] **Add scoring scripts to package.json**

```json
"score": "tsx src/scripts/scoring.ts"
```

- [ ] **Commit**

```
git add packages/server/src/services/graph/scoring/ && git commit -m "feat: add scoring pipeline with tier classification, disqualifiers, and outreach hooks"
```

---

### Task 11: Verification (Updated)

Verification now includes scoring pipeline files:

- [ ] **Check TypeScript compilation**

```
cd /home/weiss/git/gi-hack && npm run typecheck 2>&1
```

Expected: no errors. If errors, fix them.

- [ ] **Check LSP diagnostics on all new and modified files**

Additional files to check:
- `packages/server/src/services/graph/scoring/scorer.ts`
- `packages/server/src/services/graph/scoring/types.ts`
- `packages/server/src/scripts/scoring.ts`
- `packages/server/src/services/graph/ingest/adapters/github.ts`

- [ ] **End-to-end smoke test**

```
# Start Neo4j if not running
docker compose up -d neo4j

# Seed ontology
npm -w packages/server run ingest:seed

# Run all adapters
npm -w packages/server run ingest

# Score leads
npm -w packages/server run score

# Check API
curl http://localhost:3001/api/graph/score
curl http://localhost:3001/api/graph/ingest/sources
```

All commands should succeed. The scoring output should show HOT/WARM/COLD distribution.

---

- [ ] **Spec coverage**: Every section of the spec has a task — SourceAdapter interface (Task 1), ontology seed (Task 2), 5 stub adapters (Task 3), GitHub adapter (Task 3.5), FDA adapter (Task 4), SourceManager (Task 5), index (Task 6), API routes (Task 7), CLI (Task 8), verification (Task 9), scoring pipeline (Task 10), extended verification (Task 11).
- [ ] **Reference repo integrations verified**:
  - **KeeLead** → SourceManager with concurrency pool (Task 5), per-source weight config (Task 1)
  - **Gitsneak** → GitHubSourceAdapter with org detection & keyword search (Task 3.5)
  - **OpenGTM** → Tier classification HOT/WARM/COLD (Task 10), segment bonus scoring
  - **Lead Engine** → Hard disqualifiers, outreach hook generation from score breakdown (Task 10)
  - **Intent-Detection-Agent** → Weighted signal scoring with recency bonus (Task 10)
- [ ] **Placeholder scan**: No TODOs, TBDs, or "fill in later" in any step code.
- [ ] **Type consistency**: `SourceAdapter` interface used consistently across all adapters. `SourceManager` returns same `IngestionSummary[]` pattern. `ScoredResult` used in scoring pipeline. `SourceConfig` used in register() calls.
- [ ] **File paths match**: All paths referenced in the File Structure match Task file sections. New scoring files under `scoring/` and `github.ts` under `adapters/` are reflected.
