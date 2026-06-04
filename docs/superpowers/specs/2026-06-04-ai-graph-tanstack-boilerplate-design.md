# StartMiUp Hackathon — AI-Graph-TanStack Boilerplate

> **Architecture Design (arc42-based)**
> Datum: 2026-06-04
> Autor: Sisyphus (generated)

---

## 1. Introduction and Goals

### 1.1 Requirements Overview

A ready-to-hack boilerplate for the **StartMiUp Hackathon – AI for Mittelhessen** (June 5–7, 2026).

The boilerplate combines:
- **TanStack** (Router + Query) for a type-safe React frontend
- **Graph database** (Neo4j) for connected data
- **AI/LLM** integration for intelligent features

### 1.2 Quality Goals

| # | Goal | Motivation |
|---|---|---|
| 1 | **Quick start** | `git clone && npm install && npm run dev` — working in <5 min |
| 2 | **Type safety** | Share types between client & server, no runtime surprises |
| 3 | **Flexible** | Easy to swap AI provider, graph queries, or frontend routes |
| 4 | **Hackathon-ready** | Pre-configured tooling, documented architecture, minimal boilerplate |

### 1.3 Stakeholders

| Role | Interest |
|---|---|
| **Developer (Du)** | Productive immediately, focus on challenge logic |
| **Hackathon Jury** | See a working prototype with clean architecture |
| **Team Members** | Understand structure fast, can contribute without ramp-up |

---

## 2. Architecture Constraints

| Constraint | Impact |
|---|---|
| **48h hackathon timeline** | No complex infra, no custom auth, no microservices |
| **Local development** | Everything runs via `docker compose` + `npm run dev` |
| **Hackathon WiFi** | Cloud API keys (OpenAI) are OK, but core stack runs locally |
| **English working language** | Code, docs, and commits in English |

---

## 3. System Scope and Context

```
┌──────────────┐     HTTP      ┌──────────────┐    Bolt     ┌──────────────┐
│   Browser    │ ◄──────────► │  Express API │ ◄──────────► │    Neo4j     │
│  (Vite+React)│              │   (Server)   │              │  (Docker)    │
│  TanStack R+Q│              │   :3001       │              │  :7687       │
└──────────────┘              └──────┬───────┘              └──────────────┘
                                     │
                                     │ HTTPS
                                     ▼
                              ┌──────────────┐
                              │  AI Provider  │
                              │  (OpenAI/etc) │
                              └──────────────┘
```

**External interfaces:**
- **Browser ↔ Server**: REST/JSON via `fetch` + TanStack Query
- **Server ↔ Neo4j**: Bolt protocol via `neo4j-driver`
- **Server ↔ AI Provider**: OpenAI SDK (or Anthropic, or local LLM)

---

## 4. Solution Strategy

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Monorepo tool** | npm workspaces | Zero extra tooling, hackathon-safe |
| **Frontend framework** | React 19 + Vite | Fast DX, Vite HMR |
| **Routing** | TanStack Router | Type-safe routes, file-based or code-based |
| **Data fetching** | TanStack Query | Caching, loading states, devtools |
| **Styling** | Tailwind CSS v4 | Utility-first, no build step config |
| **Backend** | Express + tsx watch | Familiar, simple, fast iteration |
| **Graph DB** | Neo4j (docker) | Cypher, natural fit for connected data |
| **AI SDK** | Vercel AI SDK | Provider-agnostic, streaming support |
| **Types** | TypeScript project references | Shared types, no runtime cost |

### Architecture Pattern
- **Client-Server** separation (not SSR)
- **Shared types** package consumed by both sides
- **Docker Compose** for Neo4j (and future services)
- **`.env`** for all secrets and configuration

---

## 5. Building Block View

### Level 1 — Overall System (Whitebox)

```
gi-hack/
├── packages/
│   ├── client/           # Vite + React + TanStack Router + TanStack Query
│   ├── server/           # Express API + Graph Service + AI Service
│   └── shared/           # TypeScript types used by both
├── docker-compose.yml    # Neo4j (and future services)
├── .env                  # Secrets & config (gitignored)
├── .env.example          # Template for .env (committed)
└── docs/                 # arc42 documentation + Quickstart
```

### Level 2 — Package Details

#### `packages/client`

| File / Module | Responsibility |
|---|---|
| `src/routes/__root.tsx` | Root layout with TanStack Router outlet |
| `src/routes/index.tsx` | Landing page / demo |
| `src/routes/graph.lazy.tsx` | Graph explorer page (hackathon feature playground) |
| `src/routes/chat.lazy.tsx` | AI Chat page (hackathon feature playground) |
| `src/lib/api.ts` | TanStack Query client + fetch wrapper |
| `src/lib/graphql.ts` | Graph-specific query hooks |
| `src/lib/ai.ts` | AI-specific query hooks |

#### `packages/server`

| File / Module | Responsibility |
|---|---|
| `src/index.ts` | Express app bootstrap, CORS, middleware |
| `src/routes/api.ts` | `/api/*` router mount |
| `src/routes/graph.ts` | `POST /api/graph/query` — Cypher execution |
| `src/routes/ai.ts` | `POST /api/ai/ask` — LLM prompts |
| `src/services/graph/neo4j.ts` | Neo4j driver connection + query helpers |
| `src/services/ai/llm.ts` | AI SDK wrapper (OpenAI, Anthropic, etc.) |

#### `packages/shared`

| File | Responsibility |
|---|---|
| `src/types.ts` | All shared types (GraphNode, AIRequest, ApiResponse, etc.) |
| `package.json` | Exports `./src/types.ts` for both client and server |
| `tsconfig.json` | TypeScript project reference config |

---

## 6. Runtime View

### Flow: User queries the graph with AI explanation

```
1. User types question in chat UI
2. TanStack Query sends POST /api/ai/ask { prompt }
3. Server AIService receives prompt
4. Server GraphService queries Neo4j for relevant context
5. Server AIService sends { prompt + graphContext } to OpenAI
6. Server streams response back via SSE
7. TanStack Query updates cache, UI renders streaming tokens
8. If user clicks a graph node → TanStack Router navigates to node detail
```

### Flow: Hackathon startup

```
1. docker compose up -d neo4j         → Neo4j ready on :7687
2. cp .env.example .env               → Configure API keys
3. npm install (workspaces)            → All deps installed
4. npm run dev                         → Client :5173 + Server :3001
5. Open http://localhost:5173          → Working app
```

---

## 7. Deployment View

### Local Development (primary)

| Service | Port | Technology |
|---|---|---|
| Client (Vite dev) | 5173 | Vite + React |
| Server (Express) | 3001 | tsx watch |
| Neo4j (Browser) | 7474 | docker / Neo4j |
| Neo4j (Bolt) | 7687 | docker / Neo4j |

### docker-compose.yml

```yaml
version: "3.8"
services:
  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474"   # Browser UI
      - "7687:7687"   # Bolt protocol
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD:-password}
      NEO4J_PLUGINS: '["apoc"]'
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs

volumes:
  neo4j_data:
  neo4j_logs:
```

### Deployment (optional, for final presentation)

- **Server**: Docker image → any PaaS (Railway, Fly.io, render.com)
- **Client**: Static build via `vite build` → any static host
- **Neo4j**: AuraDB free tier or keep local + demo

---

## 8. Cross-cutting Concepts

### 8.1 Error Handling

```typescript
// Shared error format
interface ApiError {
  code: string;     // e.g. "GRAPH_QUERY_FAILED"
  message: string;  // Human-readable
}

// Server: All routes wrap in try/catch → ApiResponse.fail()
// Client: TanStack Query onError callback → toast/notification
```

### 8.2 Configuration & Secrets (`.env`)

```bash
# .env.example (committed to git)

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# AI Provider (OpenAI)
OPENAI_API_KEY=sk-...

# Optional: Alternative AI Providers
# ANTHROPIC_API_KEY=sk-ant-...
# VERTEX_AI_PROJECT=...

# Server
PORT=3001
NODE_ENV=development
```

**`.env` is gitignored.** Every deploy/developer copies `.env.example → .env`.

### 8.3 CORS

Server allows `http://localhost:5173` (Vite dev origin) in development.

### 8.4 Logging

- Server: `pino` (structured JSON, simple)
- No log aggregation needed for hackathon

### 8.5 Project Scripts

```jsonc
// Root package.json
{
  "scripts": {
    "dev":          "npm run dev --workspaces",     // Starts all packages
    "dev:client":   "npm -w packages/client run dev",
    "dev:server":   "npm -w packages/server run dev",
    "build":        "npm run build --workspaces",
    "typecheck":    "npm run typecheck --workspaces",
    "lint":         "npm run lint --workspaces"
  }
}
```

---

## 9. Design Decisions (ADRs)

### ADR-1: TanStack Router over React Router

**Context:** Need type-safe routing that scales from 2 routes to 20+.  
**Decision:** TanStack Router — full type safety on route params, search params, and links.  
**Consequences:** Slightly more boilerplate for routes, but catches URL bugs at compile time.

### ADR-2: Express over Fastify / Hono

**Context:** Simple REST API, no streaming-heavy requirements (SSE via raw Express is fine).  
**Decision:** Express — known by everyone, huge ecosystem, zero learning curve.  
**Consequences:** Less throughput than Fastify, irrelevant for hackathon scale.

### ADR-3: Neo4j Community over AuraDB

**Context:** Must run locally, no credit card for cloud, 48h timeframe.  
**Decision:** Neo4j 5 Community in Docker — free, full Cypher, APOC plugin.  
**Consequences:** No clustering, no built-in auth beyond basic — fine for local dev.

### ADR-4: Vercel AI SDK over raw OpenAI calls

**Context:** Might want to switch AI providers or add streaming.  
**Decision:** Vercel AI SDK — unified API for OpenAI, Anthropic, Google, etc.  
**Consequences:** Extra dependency, but trivial to swap providers.

---

## 10. Quality Requirements

### 10.1 Quality Tree

```
Project Quality
├── Developer Experience
│   ├── Fast setup (<5 min)
│   └── Hot reload (client + server)
├── Correctness
│   ├── Type safety across client/server boundary
│   └── No `any` or `@ts-ignore`
├── Maintainability
│   ├── Clean monorepo structure
│   └── arc42 documentation
└── Flexibility
    ├── Swappable AI provider
    └── Easy to add new routes / graph queries
```

### 10.2 Quality Scenarios

| Scenario | Measure |
|---|---|
| New team member joins | Understands structure from arc42 docs in <15 min |
| Challenge requires RAG | AI service has `askWithContext()` — add graph query, done |
| Need new page | Add route file, add TanStack Query hook, done |

---

## 11. Risks and Technical Debt

| Risk | Mitigation |
|---|---|
| **API keys leaked** | `.env` in `.gitignore`, `.env.example` has placeholders |
| **Neo4j not starting** | Docker Compose healthcheck, documented troubleshooting |
| **Hackathon WiFi blocks OpenAI** | AI service abstracts provider — swap to Anthropic or local Ollama |
| **TanStack Router learning curve** | Documented example routes, keep to 3-5 routes max |
| **Monorepo confusion** | Clear README, `npm run dev` starts everything |

---

## 12. Glossary

| Term | Definition |
|---|---|
| **TanStack** | Family of React libraries (Router, Query) |
| **arc42** | Template for documenting software architecture (12 sections) |
| **Neo4j** | Graph database, uses Cypher query language |
| **Cypher** | Graph query language (like SQL for graphs) |
| **Bolt** | Binary protocol for Neo4j connections |
| **APOC** | Neo4j plugin with utility procedures |
| **Vercel AI SDK** | Library for streaming AI responses from multiple providers |
| **TanStack Query** | Server state management with caching and deduplication |
| **TanStack Router** | Type-safe routing for React |
| **Monorepo** | Multiple packages in a single repository |

---

## Appendix A: Files to create

```
Root:
├── .env.example          # Template for secrets
├── .gitignore            # node_modules, .env, dist
├── docker-compose.yml    # Neo4j service
├── package.json          # Workspace root
├── tsconfig.base.json    # Shared TS config
├── README.md             # Project overview

packages/
├── client/
│   ├── package.json
│   ├── tsconfig.json     # extends base
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.ts        # (if needed)
│   ├── postcss.config.js         # (if needed)
│   └── src/
│       ├── main.tsx
│       ├── App.css                        # (if minimal)
│       ├── routeTree.gen.ts
│       ├── routes/
│       │   ├── __root.tsx
│       │   ├── index.tsx
│       │   ├── graph.lazy.tsx
│       │   └── chat.lazy.tsx
│       └── lib/
│           ├── api.ts
│           ├── graph.ts
│           └── ai.ts
├── server/
│   ├── package.json
│   ├── tsconfig.json     # extends base
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   ├── api.ts
│       │   ├── graph.ts
│       │   └── ai.ts
│       └── services/
│           ├── graph/
│           │   └── neo4j.ts
│           └── ai/
│               └── llm.ts
└── shared/
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── types.ts

docs/
├── arc42/
│   ├── README.md
│   ├── 01-introduction-and-goals.md
│   ├── 02-architecture-constraints.md
│   ├── 03-system-scope-and-context.md
│   ├── 04-solution-strategy.md
│   ├── 05-building-block-view.md
│   ├── 06-runtime-view.md
│   ├── 07-deployment-view.md
│   ├── 08-cross-cutting-concepts.md
│   ├── 09-design-decisions.md
│   ├── 10-quality-requirements.md
│   ├── 11-risks-and-technical-debt.md
│   └── 12-glossary.md
└── QUICKSTART.md
```
