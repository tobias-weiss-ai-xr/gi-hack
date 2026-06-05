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

## Task Distribution — 4 Collaborators

### You — Ingestion Pipeline (data → Neo4j)

| # | Task | Files |
|---|------|-------|
| 1 | Types — SourceAdapter interface, data shapes, scoring types | `packages/server/src/services/graph/ingest/types.ts` |
| 2 | Ontology seed — constraints, 7 application areas, 15 competitor companies, 10 products, seed signals | `packages/server/src/services/graph/ingest/ontology.ts` |
| 3 | 5 stub adapters (ClinicalTrials, Patent, Hiring, Conference, Funding) | `packages/server/src/services/graph/ingest/adapters/*-stub.ts` |
| 4 | FDA 510(k) real adapter — `api.fda.gov` product code filtering | `packages/server/src/services/graph/ingest/adapters/fda-510k.ts` |
| 5 | GitHub real adapter — org detection + diagnostic keyword search | `packages/server/src/services/graph/ingest/adapters/github.ts` |
| 6 | SourceManager — KeeLead-inspired concurrent executor (pool=3, weight-sorted) | `packages/server/src/services/graph/ingest/orchestrator.ts` |
| 7 | Index + wire to routes — single manager, weight config | `packages/server/src/services/graph/ingest/index.ts`, `routes/graph.ts` |
| 8 | CLI scripts — `npm run ingest`, `npm run ingest:seed` | `packages/server/src/scripts/ingest.ts` |

### Collaborator A — Lead Dashboard UI

| # | Task | Files |
|---|------|-------|
| A1 | `GET /api/graph/score` API — scored companies with tiers | `routes/graph.ts`, `scoring/scorer.ts` |
| A2 | Lead table page — score-sorted, tier badges, companies | `client/src/routes/leads.tsx` |
| A3 | Filter bar — tier, segment, application area | `client/src/routes/leads.tsx` + `lib/leads.ts` |
| A4 | Company detail drawer — signals timeline, score breakdown | `client/src/routes/leads/$id.tsx` |
| A5 | Dashboard home — pipeline summary cards, top 5 leads | `client/src/routes/index.tsx` |

### Collaborator B — Pipeline & CRM Tracking

| # | Task | Files |
|---|------|-------|
| B1 | Pipeline data model — `Contact`, `PipelineStage` nodes, `HAS_ACTIVITY` edges | `server/src/services/graph/pipeline/types.ts` |
| B2 | Pipeline API — CRUD for stages, status transitions | `server/src/routes/pipeline.ts` |
| B3 | Notes API — add/view activity per company | `server/src/routes/pipeline.ts` |
| B4 | Pipeline kanban view — New → Contacted → Meeting → Proposal → Closed | `client/src/routes/pipeline.tsx` |
| B5 | Activity log timeline | `client/src/routes/leads/$id.tsx` (extend) |

### Collaborator C — AI Outreach & Scoring

| # | Task | Files |
|---|------|-------|
| C1 | AI company enrichment — LLM fills gaps (segment, domain, applications) | `server/src/services/ai/enrich.ts` |
| C2 | AI outreach email generator — personalized cold emails from signals | `server/src/services/ai/outreach.ts` |
| C3 | Enrichment API — POST `/api/ai/enrich/:companyId`, `/api/ai/outreach/:companyId` | `server/src/routes/ai.ts` (extend) |
| C4 | Outreach UI — "Generate Email" button on company detail | `client/src/routes/leads/$id.tsx` (extend) |
| C5 | Scoring explainer — AI "why HOT lead" justification | `server/src/services/ai/explain.ts` + UI |

### Dependency Flow

```
Your pipeline ──► Neo4j populated with companies + signals
                      │
           ┌──────────┼──────────┐
           ▼          ▼          ▼
     Dashboard    Pipeline    AI Layer
     (reads)      (R+W)       (R+W)
```

## Extended API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/graph/ingest` | Run all ingestion adapters (or ?source=fda-510k) |
| POST | `/api/graph/seed` | Seed ontology + baseline companies |
| GET | `/api/graph/score` | Score all prospects (HOT/WARM/COLD) |
| GET | `/api/graph/ingest/sources` | List registered adapters |
| POST | `/api/pipeline/start` | Start pipeline tracking for a lead |
| PUT | `/api/pipeline/:id/advance` | Advance pipeline stage |
| POST | `/api/pipeline/:id/notes` | Add activity note |
| GET | `/api/pipeline/:id/activity` | Get activity history |
| POST | `/api/ai/enrich/:companyId` | AI-enrich company data |
| POST | `/api/ai/outreach/:companyId` | Generate outreach email |
