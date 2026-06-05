# Gi-Hack — AI Graph TanStack Boilerplate

A ready-to-hack boilerplate for the **StartMiUp Hackathon – AI for Mittelhessen**.

## What's Inside

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS v4 |
| Backend | Express + TypeScript (tsx watch) |
| Graph DB | Neo4j 5 Community + APOC (Docker) |
| AI | Vercel AI SDK (OpenAI, swappable) |

## Quick Start

**Prerequisites:** Node.js 20+, Docker, npm

```bash
# 1. Start Neo4j
docker compose up -d neo4j

# 2. Configure environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY

# 3. Install dependencies
npm install

# 4. Start development
npm run dev
```

Open **http://localhost:5173** — client on :5173, server on :3001, Neo4j Browser on :7474.

## Project Structure

```
gi-hack/
├── packages/
│   ├── client/          # Vite + React + TanStack
│   │   └── src/
│   │       ├── routes/  # Route definitions
│   │       └── lib/     # API hooks (graph, ai, query client)
│   ├── server/          # Express API
│   │   └── src/
│   │       ├── routes/  # API endpoints
│   │       └── services/# Neo4j + AI services
│   └── shared/          # TypeScript types
├── docker-compose.yml   # Neo4j service
├── .env.example         # Config template
└── docs/                # Architecture documentation
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/graph/health` | Neo4j connectivity check |
| POST | `/api/graph/query` | Execute Cypher query |
| POST | `/api/graph/seed` | Seed demo data |
| POST | `/api/ai/ask` | Ask AI (optionally with graph context) |

## Architecture

See [`docs/superpowers/specs/2026-06-04-ai-graph-tanstack-boilerplate-design.md`](docs/superpowers/specs/2026-06-04-ai-graph-tanstack-boilerplate-design.md) for the full arc42 design document.

---

# LeadGraph — Siemens Healthineers Challenge

**Problem:** Siemens Healthineers produces biological intermediates (proteins, antibodies, latex particles, blockers) at their Marburg site but lacks a B2B sales structure to identify and prioritize potential buyers.

**Solution:** Neo4j knowledge graph + AI lead scoring platform that automatically discovers, ranks, and surfaces diagnostic companies actively developing new assays.

See the full spec at [`docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md`](docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md) and the implementation plan at [`docs/superpowers/plans/2026-06-05-leadgraph-ingestion.md`](docs/superpowers/plans/2026-06-05-leadgraph-ingestion.md).

---

## Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          LEADGRAPH — FULL SOFTWARE ARCHITECTURE                   │
│              Siemens Healthineers — AI Lead Identification Platform                │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React 19 + Vite + TanStack Router/Query + Tailwind v4)                │
│  Layers: routes/ → pages, lib/ → API hooks, components/ → reusable UI             │
│                                                                                  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐              │
│  │ Dashboard (Home) Page        │  │ Lead Explorer Page            │              │
│  │  ├─ Pipeline Summary Cards   │  │  ├─ Score-sorted DataTable    │              │
│  │  │  🔥 HOT: X  ⭐ WARM: Y   │  │  ├─ Filter bar (tier,segment) │              │
│  │  │     COLD: Z               │  │  ├─ Company detail drawer    │              │
│  │  ├─ Source Health Status     │  │  │   ├─ Signals timeline     │              │
│  │  ├─ Top 5 leads card         │  │  │   ├─ Score breakdown bar  │              │
│  │  └─ [Run Ingest] button      │  │  │   └─ Outreach hook        │              │
│  └──────────────────────────────┘  └──────────────────────────────┘              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐              │
│  │ Pipeline Kanban Page         │  │ Ingest Control Panel         │              │
│  │  ├─ Columns: New → Contacted │  │  ├─ [Seed Ontology] button   │              │
│  │  │  → Meeting → Proposal     │  │  ├─ Run per-source ingest    │              │
│  │  │  → Closed Won/Lost        │  │  └─ View ingestion logs     │              │
│  │  ├─ Drag leads between cols  │  │                              │              │
│  │  └─ Activity timeline per    │  │                              │              │
│  │     lead (notes, status      │  │                              │              │
│  │     changes, emails)         │  │                              │              │
│  └──────────────────────────────┘  └──────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────┘
           │                                     ▲
           │  HTTP / JSON (TanStack Query)       │
           ▼                                     │
┌──────────────────────────────────────────────────────────────────────────────────┐
│  API SERVER (Express + TypeScript — :3001)                                        │
│  Routes: /api/graph/*, /api/pipeline/*, /api/ai/*                                 │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                     INGESTION LAYER (services/graph/ingest/)                │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  SourceManager (KeeLead-inspired) — pool=3, weight-sorted         │    │   │
│  │  │                                                                   │    │   │
│  │  │  Weight:  FDA=50 │ GitHub=40 │ ClinicalTrials=30 │ Patent=25      │    │   │
│  │  │          Hiring=20│Conference=15│Funding=10                        │    │   │
│  │  │                                                                   │    │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │    │   │
│  │  │  │FDA 510(k)│ │  GitHub  │ │ Clinical │ │  Patent  │ │ Hiring │  │    │   │
│  │  │  │  REAL    │ │  REAL    │ │  Trials  │ │  Stub    │ │ Stub   │  │    │   │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘  │    │   │
│  │  │  ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌───▼────┐  │    │   │
│  │  │  │Conference│ │ Funding  │ │          │ │          │ │        │  │    │   │
│  │  │  │  Stub    │ │  Stub    │ │  ...     │ │          │ │        │  │    │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘  │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  SCORING PIPELINE (services/graph/scoring/)                        │    │   │
│  │  │  Reads: Company → HAS_SIGNAL → Signal                              │    │   │
│  │  │         Company → DEVELOPS → Application                           │    │   │
│  │  │                                                                   │    │   │
│  │  │  For each Company WITHOUT SUPPLIES_TO relationship to Siemens:     │    │   │
│  │  │   1. SignalScore = Σ(weight × confidence × recency)       [0-40]  │    │   │
│  │  │   2. ProductFit = appOverlapRatio × 30                     [0-30]  │    │   │
│  │  │   3. SegmentBonus: IVD=20 / CDMO=15 / Supplier=10 / ...   [0-20]  │    │   │
│  │  │   4. RecencyBonus: ≤3mo=10 / ≤6mo=7 / ≤12mo=4 / >12mo=1  [0-10]  │    │   │
│  │  │   5. Check hard disqualifiers (no signals, no domain, ...)        │    │   │
│  │  │   6. Total = signal + fit + segment + recency              [0-100] │    │   │
│  │  │   7. Tier: HOT ≥ 70 / WARM ≥ 40 / COLD < 40                      │    │   │
│  │  │   8. Generate outreachHook from strongest signal type             │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  PIPELINE CRM (services/graph/pipeline/)                          │    │   │
│  │  │                                                                   │    │   │
│  │  │  Nodes:    (:Contact), (:Activity), (:PipelineStage)              │    │   │
│  │  │  Edges:    (c)-[:CONTACT_AT]->(Company)                           │    │   │
│  │  │            (c)-[:HAS_ACTIVITY]->(:Activity {type, note, date})    │    │   │
│  │  │            (c)-[:IN_STAGE]->(:PipelineStage {stage, enteredAt})    │    │   │
│  │  │                                                                   │    │   │
│  │  │  Stages:  New → Contacted → Meeting → Proposal → Closed Won/Lost  │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  AI LAYER (services/ai/)                                           │    │   │
│  │  │                                                                   │    │   │
│  │  │  Enrich:    (Company.name + signals) → LLM → (segment, domain,    │    │   │
│  │  │              applications, description)                             │    │   │
│  │  │  Outreach:  (Company + signals + tier) → LLM → (personalized      │    │   │
│  │  │              cold email with product recommendation)                │    │   │
│  │  │  Explain:   (Company + breakdown) → LLM → (plain-text "why this   │    │   │
│  │  │              lead scores what it does" justification)               │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
           │
           │  runQuery() — neo4j-driver (Bolt :7687)
           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  NEO4j KNOWLEDGE GRAPH (Docker — bolt://localhost:7687, Browser :7474)            │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │  Node Types                   │  Relationships                           │   │
│  │                               │                                          │   │
│  │  (:Company)                   │  (c)-[:SUPPLIES]->(:Product)             │   │
│  │    .name (UNIQUE)             │  (c)-[:DEVELOPS]->(:Application)         │   │
│  │    .domain (INDEXED)          │  (c)-[:HAS_SIGNAL]->(:Signal)            │   │
│  │    .segment                    │  (p)-[:USED_IN]->(:Application)          │   │
│  │    .region                     │  (c)-[:CONTACT_AT]->(:Contact)          │   │
│  │                               │  (c)-[:IN_STAGE]->(:PipelineStage)       │   │
│  │  (:Application)               │  (c)-[:HAS_ACTIVITY]->(:Activity)        │   │
│  │    .name (UNIQUE)             │                                          │   │
│  │    .category                   │                                          │   │
│  │    .marketSize                 │                                          │   │
│  │                               │                                          │   │
│  │  (:Product)                    │                                          │   │
│  │    .catalogId                  │                                          │   │
│  │    .name                       │                                          │   │
│  │    .category                   │                                          │   │
│  │                               │                                          │   │
│  │  (:Signal)                     │                                          │   │
│  │    .type (INDEXED)             │                                          │   │
│  │    .date                       │                                          │   │
│  │    .confidence (0-1)           │                                          │   │
│  │    .description                │                                          │   │
│  │    .url                        │                                          │   │
│  │                               │                                          │   │
│  │  (:Contact)                    │                                          │   │
│  │    .name, .email, .role        │                                          │   │
│  │                               │                                          │   │
│  │  (:PipelineStage)              │                                          │   │
│  │    .stage, .enteredAt          │                                          │   │
│  │                               │                                          │   │
│  │  (:Activity)                   │                                          │   │
│  │    .type, .note, .date         │                                          │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
           ▲
           │
┌──────────────────────────────────────────────────────────────────────────────────┐
│  DATA SOURCES (External)                                                           │
│                                                                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │  api.fda.gov     │ │  api.github.com  │ │  Stub: Clinical │ │  Stub: Patent   ││
│  │  /device/510k    │ │  /search/repos   │ │  Trials.gov    │ │  Filings        ││
│  │  ─────────────── │ │  /orgs/{login}  │ │  ─────────────  │ │  ─────────────  ││
│  │  REAL            │ │  ─────────────── │ │  4 simulated   │ │  5 simulated    ││
│  │  FDA clearance   │ │  REAL            │ │  trial records  │ │  patent records ││
│  │  → product codes │ │  Diag. keyword   │ │  with phases    │ │  with IPC codes ││
│  │  JPA, JSO, JXV   │ │  search on GH    │ │                 │ │                 ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘│
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │  Stub: Hiring   │ │  Stub: Conf.    │ │  Stub: Funding  │ │  Docling        ││
│  │  (LinkedIn-like)│ │  (MEDICA/ADLM)  │ │  Investment     │ │  (Future)       ││
│  │  ─────────────  │ │  ─────────────  │ │  ─────────────  │ │  ─────────────  ││
│  │  5 simulated    │ │  5 simulated    │ │  4 simulated    │ │  Python sidecar ││
│  │  R&D/QA roles   │ │  exhibitor recs │ │  VC/Grant recs  │ │  PDF → JSON     ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────────┐
│  REFERENCE REPOSITORY BORROWINGS (sources/, for inspiration only)                  │
│                                                                                  │
│  KeeLead (MIT)  ──→ SourceManager concurrency, per-source weights & config       │
│  Gitsneak (MIT) ──→ GitHub org detection, profile scraping, API caching          │
│  OpenGTM (MIT)  ──→ Tier system (HOT/WARM/COLD), ICP profiles, segment scoring   │
│  Lead Engine ─────→ Hard disqualifiers, outreach hooks from score breakdown       │
│  Intent-Detection  ──→ Signal taxonomy (FDA/Trial/Patent/Hiring/Funding/NEWS)    │
│    Agent (MIT)         + weighted scoring pipeline                                 │
└──────────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT (Docker Compose)                                                       │
│                                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                     │
│  │  Frontend    │────▶│  API Server  │────▶│  Neo4j       │                     │
│  │  :5173       │     │  :3001       │     │  :7687       │                     │
│  │  Vite dev    │     │  Express     │     │  APOC + GDS  │                     │
│  └──────────────┘     └──────────────┘     └──────────────┘                     │
│                                                                                  │
│  Env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY, GITHUB_TOKEN (opt)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Distribution — 4 Collaborators

### You: Ingestion Pipeline (data → Neo4j)

Your job is the foundation: getting data from external sources into the Neo4j graph. Nothing else can be built until this works. You build the SourceAdapter plugin system, all adapters (1 real FDA, 1 real GitHub, 5 stubs), the SourceManager that runs them concurrently, and the CLI to trigger everything.

| # | Task | What You Need To Do | Files |
|---|------|---------------------|-------|
| 1 | **Types** | Define the `SourceAdapter` interface (`fetch()`, `normalize()`, `healthCheck()`), `RawLead`/`LeadCandidate`/`Signal` data shapes, `SourceConfig` (weight, concurrency, enabled), and scoring types (`TierLevel`, `ScoreBreakdown`, `ScoredCompany`, `Disqualifier`) | `ingest/types.ts` |
| 2 | **Ontology seed** | Write Cypher to create Neo4j constraints (`Company.name UNIQUE`, `Application.name UNIQUE`, indexes), 7 application areas (Hemostasis, Plasma Proteins, etc.), 10 Siemens products linked to applications, 15 baseline competitor companies with their application areas and seed signals | `ingest/ontology.ts` |
| 3 | **5 stub adapters** | Implement `SourceAdapter` for each: ClinicalTrials (4 simulated trial records), PatentFilings (5 patent records), Hiring (5 job postings), Conference (5 trade shows), Funding (4 investment rounds). Each returns hardcoded realistic German diagnostics company data and normalizes it to `LeadCandidate` with proper signals | `ingest/adapters/*-stub.ts` |
| 4 | **FDA adapter** | Real adapter hitting `https://api.fda.gov/device/510k.json` filtered by 8 product codes (JPA, JSO, JXV, JJF, JTW, JLH, JXI, JZJ). Map product codes to application areas. Extract company names, strip legal suffixes. 10s timeout per request, graceful failure per code | `ingest/adapters/fda-510k.ts` |
| 5 | **GitHub adapter** | Real adapter searching `api.github.com/search/repositories` for 10 diagnostic keywords (elisa, ivd, immunoassay, etc.). Group results by org owner, fetch org profile for descriptions. Map GitHub topics to application areas. Generates NEWS signal per org. Needs GITHUB_TOKEN env var for higher rate limits | `ingest/adapters/github.ts` |
| 6 | **SourceManager** | Build the concurrent orchestrator. Maintains a `Map<string, {adapter, config}>`. `runAll()` runs adapters in parallel with pool limit (default 3), sorted by weight descending. Each adapter: fetch → normalize → deduplicate → upsert (MERGE Company, link DEVELOPS, CREATE signals). Robust error handling per-adapter | `ingest/orchestrator.ts` |
| 7 | **Index + routes** | Create `ingest/index.ts` that exports a singleton `SourceManager` with all 7 adapters registered at their weights. Wire it to `POST /api/graph/ingest` (with `?source=X` param) and `GET /api/graph/ingest/sources` | `ingest/index.ts`, `routes/graph.ts` |
| 8 | **CLI scripts** | Write `scripts/ingest.ts` that initializes the Neo4j driver, calls the SourceManager, and logs results. Add `package.json` scripts: `ingest`, `ingest:seed`, `ingest:fda`, `ingest:score` | `scripts/ingest.ts`, `package.json` |
| 9 | **Scoring pipeline** | Write `scoring/scorer.ts` — read all prospect companies from Neo4j, compute signal score (weighted × confidence × recency cap 40), product fit (app overlap ratio × 30), segment bonus (IVD=20/CDMO=15/Supplier=10), recency bonus (≤3mo=10). Check hard disqualifiers. Generate outreach hook from strongest signal type. Return sorted `ScoredResult[]` | `scoring/scorer.ts`, `scoring/types.ts` |

**What success looks like:** `npm run ingest:seed` populates the ontology, `npm run ingest` fetches from all 7 sources and creates Company/Signal nodes in Neo4j, `npm run score` prints HOT/WARM/COLD distribution.

---

### Collaborator A: Lead Dashboard UI

You build the React frontend that visualizes scored leads. You read from Neo4j via the API — you never write data. Your work is entirely in `packages/client/`.

| # | Task | What You Need To Do | Files |
|---|------|---------------------|-------|
| A1 | **Score API** | Add `GET /api/graph/score` route that imports and calls the scoring pipeline. Returns `{ ok: true, data: { companies: ScoredResult[] } }`. Sort descending by totalScore | `routes/graph.ts` (extend) |
| A2 | **Lead table page** | Create a new TanStack route `/leads` with a data table showing: company name, tier badge (HOT=red, WARM=yellow, COLD=gray), total score (0-100 bar), signal count, top application area, outreach hook preview. Use TanStack Query to fetch and cache | `client/src/routes/leads.tsx` |
| A3 | **Filter bar** | Add filters above the table: tier dropdown (HOT/WARM/COLD/All), segment multi-select, application area multi-select. Filter client-side from cached data. Show result count | `client/src/routes/leads.tsx` + `client/src/lib/leads.ts` |
| A4 | **Company detail drawer** | Click a row → slide-in drawer showing: full score breakdown bar chart (signal/product/segment/recency), signals timeline (ordered by date, color-coded by type), matched application areas, generated outreach hook with copy button | `client/src/routes/leads/$id.tsx` |
| A5 | **Dashboard home** | Rewrite `index.tsx` to show: 3 pipeline summary cards (HOT count, WARM count, COLD count), top 5 leads mini-table, source health indicators (green/red per adapter), [Run Ingest] button with loading state | `client/src/routes/index.tsx` |

**What success looks like:** Opening the app shows the dashboard with summary stats. Clicking into leads shows a sortable/filterable table. Clicking a company shows detail with signals timeline and score breakdown.

---

### Collaborator B: Pipeline & CRM Tracking

You build the sales pipeline management system. You define new Neo4j node types and relationships, build the API, and build the kanban UI. You both read and write to the graph.

| # | Task | What You Need To Do | Files |
|---|------|---------------------|-------|
| B1 | **Pipeline data model** | Define interfaces for `Contact` (name, email, role, phone), `PipelineStage` (stage enum, enteredAt), `Activity` (type: note/email/meeting/call, note text, date). Cypher: `MERGE (c:Contact {email})`, `MERGE (c)-[:CONTACT_AT]->(company)`, `MERGE (c)-[:IN_STAGE]->(:PipelineStage)`, `MERGE (c)-[:HAS_ACTIVITY]->(:Activity)` | `server/src/services/graph/pipeline/types.ts` |
| B2 | **Pipeline API** | `POST /api/pipeline/start {companyName, contact?}` — creates Contact + initial PipelineStage(New). `GET /api/pipeline/leads` — returns all pipeline leads with current stage. `PUT /api/pipeline/:id/advance {stage}` — creates new PipelineStage, archives previous | `server/src/routes/pipeline.ts` |
| B3 | **Notes API** | `POST /api/pipeline/:id/notes {type, note}` — adds Activity. `GET /api/pipeline/:id/activity` — returns all activities sorted by date desc | `server/src/routes/pipeline.ts` (extend) |
| B4 | **Kanban view** | Create a TanStack route `/pipeline` with 5 columns: New, Contacted, Meeting, Proposal Proposal, Closed Won/Lost. Each column shows company cards with name, score, tier badge. Drag & drop between columns (calls advance API). Use `@dnd-kit/core` or native HTML5 drag | `client/src/routes/pipeline.tsx` |
| B5 | **Activity timeline** | On the company detail drawer (A4), add a "Pipeline" tab showing: current stage, contact info, activity log with timestamps. Inline "Add Note" form. Stage advance button with confirmation | Extend `client/src/routes/leads/$id.tsx` |

**What success looks like:** Finding a HOT lead → clicking "Start Pipeline" → it appears in the "New" column → drag to "Contacted" → add a note → it shows in the activity timeline.

---

### Collaborator C: AI Outreach & Scoring

You build the AI-powered layer that makes LeadGraph intelligent. You use the Vercel AI SDK (already set up with OpenAI) to enrich company data, generate outreach emails, and explain scoring decisions.

| # | Task | What You Need To Do | Files |
|---|------|---------------------|-------|
| C1 | **AI company enrichment** | Write a function `enrichCompany(name: string, signals: Signal[])` that calls `generateText()` from the Vercel AI SDK. System prompt: "You are a diagnostics industry analyst. Given a company name and signals, infer their market segment (IVD_MANUFACTURER/CDMO/SUPPLIER/RESEARCH), domain name if missing, relevant application areas, and a concise 2-sentence description." Returns structured JSON. Only update fields that are null in the graph | `server/src/services/ai/enrich.ts` |
| C2 | **AI outreach email** | Write `generateOutreach(company: ScoredResult, products: Product[])` that calls the AI. System prompt: "You are a B2B sales engineer at Siemens Healthineers. Write a personalized cold email to [company] referencing their recent [strongest signal]. Suggest relevant products from our catalog. Keep it 3-4 paragraphs, professional but warm, with a clear CTA." Returns email body as string | `server/src/services/ai/outreach.ts` |
| C3 | **Enrichment API** | `POST /api/ai/enrich/:companyId` — calls enrichCompany, writes result to Neo4j (UPDATE Company SET segment/domain/description). `POST /api/ai/outreach/:companyId` — calls generateOutreach, optionally stores as Activity in pipeline. Both require existing `ai.ts` route pattern | Extend `server/src/routes/ai.ts` |
| C4 | **Outreach UI** | Add "Generate Email" button to the company detail drawer (A4). On click, calls `/api/ai/outreach/:companyId` and shows the generated email in a modal with Copy and Send (download .txt) buttons. Loading state while AI generates | Extend `client/src/routes/leads/$id.tsx` |
| C5 | **Scoring explainer** | Write `explainScore(company: ScoredResult)` that sends the score breakdown to the AI: "Explain in 2-3 sentences why [company] scored [total]/100. Mention which signals contributed most, their product fit, and segment advantage." Add "Why this score?" button next to score in the lead table and drawer | `server/src/services/ai/explain.ts` + API + UI hookup |

**What success looks like:** Viewing a lead → click "Enrich" → company segment/domain populated by AI → click "Generate Email" → professional cold email referencing their FDA clearance appears → click "Why this score?" → plain English explanation of their 85/100 HOT rating.

---

## Dependency Flow

```
                     ┌─────────────────────────────────────┐
                     │  You: Ingestion Pipeline             │
                     │  Task 1-9: types → adapters →        │
                     │  SourceManager → seed → ingest →     │
                     │  score                                │
                     │                                       │
                     │  OUTPUT: Neo4j full of companies,     │
                     │  signals, scores, tiers               │
                     └─────────────────┬───────────────────┘
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
              ┌────────────────┐ ┌────────────┐ ┌──────────────┐
              │ Collab A       │ │ Collab B   │ │ Collab C     │
              │ Lead Dashboard │ │ Pipeline   │ │ AI Layer     │
              │                │ │ CRM        │ │              │
              │ Reads from     │ │ Reads AND  │ │ Reads AND    │
              │ Neo4j via API  │ │ writes to  │ │ writes to    │
              │ (read-only)    │ │ Neo4j      │ │ Neo4j        │
              │                │ │            │ │              │
              │ Tasks A1-A5    │ │ Tasks B1-B5│ │ Tasks C1-C5  │
              └────────────────┘ └────────────┘ └──────────────┘
```

**Parallel execution:** All 3 collaborators can start as soon as the graph schema is known (YOU Task 2). Collaborator A needs scoring data (YOU Task 9) for full functionality but can build the UI with mock data first. Collaborators B and C are fully independent.

---

## Extended API Endpoints

| Method | Path | Description | Owner |
|--------|------|-------------|-------|
| POST | `/api/graph/seed` | Seed ontology + baseline companies | You |
| POST | `/api/graph/ingest` | Run all ingestion adapters (or `?source=fda-510k`) | You |
| GET | `/api/graph/score` | Score all prospects (HOT/WARM/COLD) | A |
| GET | `/api/graph/ingest/sources` | List registered adapters | You |
| GET | `/api/graph/health` | Neo4j connectivity check | — |
| POST | `/api/graph/query` | Execute arbitrary Cypher | — |
| POST | `/api/pipeline/start` | Start pipeline tracking for a lead | B |
| GET | `/api/pipeline/leads` | Get all pipeline leads with current stage | B |
| PUT | `/api/pipeline/:id/advance` | Advance to next pipeline stage | B |
| POST | `/api/pipeline/:id/notes` | Add activity note | B |
| GET | `/api/pipeline/:id/activity` | Get activity history | B |
| POST | `/api/ai/enrich/:companyId` | AI-enrich company data (segment, domain) | C |
| POST | `/api/ai/outreach/:companyId` | Generate personalized outreach email | C |
| GET | `/api/ai/explain/:companyId` | AI justification of score breakdown | C |
| POST | `/api/ai/ask` | General AI chat with graph context | — |
