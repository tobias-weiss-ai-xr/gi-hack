# LeadGraph — Full Software Architecture

```
                          LEADGRAPH — FULL SOFTWARE ARCHITECTURE
              Siemens Healthineers — AI Lead Identification Platform
```

## Frontend (React 19 + Vite + TanStack Router/Query + Tailwind v4)

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ Dashboard (Home) Page        │  │ Lead Explorer Page            │
│  ├─ Pipeline Summary Cards   │  │  ├─ Score-sorted DataTable    │
│  │  🔥 HOT: X  ⭐ WARM: Y   │  │  ├─ Filter bar (tier,segment) │
│  │     COLD: Z               │  │  ├─ Company detail drawer    │
│  ├─ Source Health Status     │  │  │   ├─ Signals timeline     │
│  ├─ Top 5 leads card         │  │  │   ├─ Score breakdown bar  │
│  └─ [Run Ingest] button      │  │  │   └─ Outreach hook        │
└──────────────────────────────┘  └──────────────────────────────┘
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ Pipeline Kanban Page         │  │ Ingest Control Panel         │
│  ├─ Columns: New → Contacted │  │  ├─ [Seed Ontology] button   │
│  │  → Meeting → Proposal     │  │  ├─ Run per-source ingest    │
│  │  → Closed Won/Lost        │  │  └─ View ingestion logs     │
│  ├─ Drag leads between cols  │  │                              │
│  └─ Activity timeline per    │  │                              │
│     lead (notes, status      │  │                              │
│     changes, emails)         │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘
           │                                     ▲
           │  HTTP / JSON (TanStack Query)       │
           ▼                                     │
```

## API Server (Express + TypeScript — :3001)

### Ingestion Layer (services/graph/ingest/)
```
SourceManager (KeeLead-inspired) — pool=3, weight-sorted

FDA=50 │ GitHub=40 │ ClinicalTrials=30 │ OpenAlex=28 │ EPatent=23
DRKS=22 │ Patent=25 │ Hiring=20 │ Medica=18 │ Foekat=15 │ Conf=15
Funding=10

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐
│FDA 510(k)│ │  GitHub  │ │ Clinical │ │ OpenAlex │ │  EPO   │
│  REAL    │ │  REAL    │ │  Trials  │ │  REAL    │ │  OPS   │
│          │ │          │ │  REAL    │ │ (pubs)   │ │ (pat.) │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  DRKS    │ │  MEDICA  │ │  FÖKAT   │ │  4 Stubs │
│  REAL    │ │  REAL    │ │  REAL    │ │ (pat/hire │
│ (trials) │ │ (conf.)  │ │ (grants) │ │ /conf/fnd)│
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Scoring Pipeline (services/graph/scoring/)
```
For each Company WITHOUT SUPPLIES_TO relationship to Siemens:
  1. SignalScore = Σ(weight × confidence × recency)       [0-40]
  2. ProductFit = appOverlapRatio × 30                     [0-30]
  3. SegmentBonus: IVD=20 / CDMO=15 / Supplier=10 / ...   [0-20]
  4. RecencyBonus: ≤3mo=10 / ≤6mo=7 / ≤12mo=4 / >12mo=1  [0-10]
  5. Check hard disqualifiers (no signals, no domain, ...)
  6. Total = signal + fit + segment + recency              [0-100]
  7. Tier: HOT ≥ 70 / WARM ≥ 40 / COLD < 40
  8. Generate outreachHook from strongest signal type
```

### Pipeline CRM (services/graph/pipeline/)
```
Nodes:    (:Contact), (:Activity), (:PipelineStage)
Edges:    (c)-[:CONTACT_AT]->(Company)
          (c)-[:HAS_ACTIVITY]->(:Activity {type, note, date})
          (c)-[:IN_STAGE]->(:PipelineStage {stage, enteredAt})
Stages:   New → Contacted → Meeting → Proposal → Closed Won/Lost
```

### AI Layer (services/ai/)
```
Enrich:    (Company.name + signals) → LLM → (segment, domain,
            applications, description)
Outreach:  (Company + signals + tier) → LLM → (personalized
            cold email with product recommendation)
Explain:   (Company + breakdown) → LLM → (plain-text "why this
            lead scores what it does" justification)
```

## Neo4j Knowledge Graph (Docker — bolt://localhost:7687, Browser :7474)

```
Node Types               │  Relationships
                         │
(:Company)               │  (c)-[:SUPPLIES]->(:Product)
  .name (UNIQUE)         │  (c)-[:DEVELOPS]->(:Application)
  .domain (INDEXED)      │  (c)-[:HAS_SIGNAL]->(:Signal)
  .segment               │  (p)-[:USED_IN]->(:Application)
  .region                │  (c)-[:CONTACT_AT]->(:Contact)
                         │  (c)-[:IN_STAGE]->(:PipelineStage)
(:Application)           │  (c)-[:HAS_ACTIVITY]->(:Activity)
  .name (UNIQUE)         │
  .category              │
  .marketSize            │
                         │
(:Product)               │
  .catalogId             │
  .name                  │
  .category              │
                         │
(:Signal)                │
  .type (INDEXED)        │
  .date                  │
  .confidence (0-1)      │
  .description           │
  .url                   │
                         │
(:Contact)               │
  .name, .email, .role   │
                         │
(:PipelineStage)         │
  .stage, .enteredAt     │
                         │
(:Activity)              │
  .type, .note, .date    │
```

## Data Sources (External)

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ api.fda.gov  │ │ api.github   │ │ clinicaltrials│ │ api.openalex │
│ /device/510k │ │ .com/search  │ │ .gov         │ │ .org/works   │
│ FDA 510(k)   │ │ Diagnostic   │ │ Clinical     │ │ Research     │
│ REAL ── 8    │ │ keyword org  │ │ Trials       │ │ publications │
│ product code │ │ detection    │ │ REAL (US)    │ │ REAL         │
│ filters      │ │ REAL         │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ drks.de      │ │ epo.org      │ │ medica-tradefair│ foerderportal│
│ /search/     │ │ /ops/restful │ │ .com/vis/v1  │ .bund.de/     │
│ download/all │ │ DE patents   │ │ Exhibitor DB │ foekat        │
│ DRKS (DE)    │ │ by IPC codes │ │ MEDICA (DE)  │ FÖKAT grants │
│ REAL (DACH)  │ │ REAL (DACH)  │ │ REAL (DACH)  │ REAL (DACH)   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Stub: Patent │ │ Stub: Hiring │ │ Stub: Conf.  │ │ Stub: Funding│
│ (fallback)   │ │ (fallback)   │ │ (fallback)   │ │ (fallback)   │
│ 5 simulated  │ │ 5 simulated  │ │ 5 simulated  │ │ 4 simulated  │
│ patent recs  │ │ R&D/QA roles │ │ exhibitor    │ │ VC/grant recs│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

## Reference Repository Borrowings

| Repo | Inspiration |
|------|-------------|
| KeeLead (MIT) | SourceManager concurrency, per-source weights & config |
| Gitsneak (MIT) | GitHub org detection, profile scraping, API caching |
| OpenGTM (MIT) | Tier system (HOT/WARM/COLD), ICP profiles, segment scoring |
| Lead Engine | Hard disqualifiers, outreach hooks from score breakdown |
| Intent-Detection Agent (MIT) | Signal taxonomy + weighted scoring pipeline |
