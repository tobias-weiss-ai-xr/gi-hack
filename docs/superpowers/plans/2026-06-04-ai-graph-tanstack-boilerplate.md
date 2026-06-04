# AI-Graph-TanStack Boilerplate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional monorepo boilerplate combining TanStack (Router + Query) with Neo4j graph DB + Vercel AI SDK, ready for 48h hackathon use.

**Architecture:** npm workspaces monorepo with `packages/client` (Vite + React 19 + TanStack Router + TanStack Query + Tailwind CSS v4), `packages/server` (Express + tsx watch + neo4j-driver + Vercel AI SDK), and `packages/shared` (TypeScript types). Neo4j runs in Docker. Two demo pages: Chat (AI playground) and Graph Explorer. Root `npm run dev` starts everything concurrently.

**Tech Stack:** TypeScript, React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, Express, Neo4j 5, Vercel AI SDK, Docker Compose, pino, tsx, npm workspaces

---

### Task 1: Root project scaffolding

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "gi-hack",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently -n client,server -c cyan,green \"npm -w packages/client run dev\" \"npm -w packages/server run dev\"",
    "dev:client": "npm -w packages/client run dev",
    "dev:server": "npm -w packages/server run dev",
    "build": "npm run build --workspaces",
    "typecheck": "npm run typecheck --workspaces",
    "lint": "npm run lint --workspaces"
  },
  "devDependencies": {
    "concurrently": "^9.1.2",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 4: Create `.env.example`**

```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# AI Provider (OpenAI)
OPENAI_API_KEY=sk-your-key-here

# Optional: Alternative AI Providers
# ANTHROPIC_API_KEY=sk-ant-...

# Server
PORT=3001
NODE_ENV=development
```

- [ ] **Step 5: Create `docker-compose.yml`**

```yaml
version: "3.8"
services:
  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474"
      - "7687:7687"
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

- [ ] **Step 6: Verify scaffolding**

```bash
ls -la package.json tsconfig.base.json .gitignore .env.example docker-compose.yml
```
Expected: All 5 files exist.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold root project (workspaces, docker, config)"
```

---

### Task 2: Shared types package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@gi-hack/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/types.ts"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/src/types.ts`**

```typescript
// ─── API Response ──────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Graph Types ──────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

// ─── AI Types ─────────────────────────────────────────────────────────────

export interface AIRequest {
  prompt: string;
  context?: string;
}

export interface AIStreamChunk {
  type: "text" | "error" | "done";
  content: string;
}

// ─── Health Check ─────────────────────────────────────────────────────────

export interface HealthStatus {
  status: "ok" | "degraded";
  services: {
    neo4j: "connected" | "disconnected";
    ai: "configured" | "missing_key";
  };
  uptime: number;
}
```

- [ ] **Step 4: Verify shared package**

```bash
ls -la packages/shared/package.json packages/shared/tsconfig.json packages/shared/src/types.ts
```
Expected: All 3 files exist.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add shared types package"
```

---

### Task 3: Server scaffolding + package config

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`

- [ ] **Step 1: Create `packages/server/package.json`**

```json
{
  "name": "@gi-hack/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gi-hack/shared": "*",
    "@vercel/ai-sdk": "^1.0.0",
    "ai": "^4.1.61",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "neo4j-driver": "^5.28.0",
    "openai": "^4.86.2",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.1",
    "@types/node": "^22.14.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: add server package config"
```

---

### Task 4: Server Neo4j service

**Files:**
- Create: `packages/server/src/services/graph/neo4j.ts`

- [ ] **Step 1: Create `packages/server/src/services/graph/neo4j.ts`**

```typescript
import neo4j, { Driver, Session } from "neo4j-driver";
import pino from "pino";

const logger = pino({ name: "neo4j-service" });

let driver: Driver | null = null;

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export function createDriver(config: Neo4jConfig): Driver {
  if (driver) return driver;

  driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password), {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    maxConnectionPoolSize: 10,
  });

  return driver;
}

export async function verifyConnection(): Promise<boolean> {
  if (!driver) return false;
  try {
    await driver.getServerInfo();
    return true;
  } catch (err) {
    logger.error(err, "Neo4j connection failed");
    return false;
  }
}

export async function runQuery(
  cypher: string,
  params: Record<string, unknown> = {}
) {
  if (!driver) throw new Error("Neo4j driver not initialized");

  const session: Session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return {
      records: result.records.map((record) => ({
        keys: record.keys,
        values: record.values().map((v) => v.toString()),
      })),
      summary: {
        counters: result.summary.counters._stats,
      },
    };
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add Neo4j service (driver, query, health check)"
```

---

### Task 5: Server AI service

**Files:**
- Create: `packages/server/src/services/ai/llm.ts`

- [ ] **Step 1: Create `packages/server/src/services/ai/llm.ts`**

```typescript
import { streamText, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import pino from "pino";

const logger = pino({ name: "ai-service" });

export interface AIConfig {
  apiKey: string;
  model?: string;
}

export function createAIProvider(config: AIConfig) {
  const openai = createOpenAI({
    apiKey: config.apiKey,
  });

  const model = config.model ?? "gpt-4o-mini";

  return { openai, model };
}

export function isConfigured(apiKey: string | undefined): boolean {
  return !!apiKey && apiKey !== "sk-your-key-here" && apiKey.startsWith("sk-");
}

export async function askAI(
  apiKey: string,
  prompt: string,
  context?: string
) {
  const { openai, model } = createAIProvider({ apiKey });

  const systemPrompt = context
    ? `You are a helpful hackathon assistant. Use this graph data context to answer:\n\n${context}`
    : "You are a helpful hackathon assistant.";

  const result = await generateText({
    model: openai(model),
    system: systemPrompt,
    prompt,
  });

  return result.text;
}

export async function askAIStreaming(
  apiKey: string,
  prompt: string,
  context?: string
) {
  const { openai, model } = createAIProvider({ apiKey });

  const systemPrompt = context
    ? `You are a helpful hackathon assistant. Use this graph data context to answer:\n\n${context}`
    : "You are a helpful hackathon assistant.";

  return streamText({
    model: openai(model),
    system: systemPrompt,
    prompt,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add AI service (Vercel AI SDK, OpenAI, streaming)"
```

---

### Task 6: Server graph routes

**Files:**
- Create: `packages/server/src/routes/graph.ts`

- [ ] **Step 1: Create `packages/server/src/routes/graph.ts`**

```typescript
import { Router, Request, Response } from "express";
import { runQuery, verifyConnection } from "../services/graph/neo4j.js";

const router = Router();

// POST /api/graph/query — Execute arbitrary Cypher query
router.post("/query", async (req: Request, res: Response) => {
  try {
    const { cypher, params } = req.body;

    if (!cypher || typeof cypher !== "string") {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_INPUT", message: "cypher field is required" },
      });
      return;
    }

    const result = await runQuery(cypher, params ?? {});
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "GRAPH_QUERY_FAILED", message },
    });
  }
});

// POST /api/graph/seed — Seed demo data
router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const seedQueries = [
      `CREATE (p:Person {name: "Alice", role: "Developer"})`,
      `CREATE (p:Person {name: "Bob", role: "Designer"})`,
      `CREATE (p:Person {name: "Charlie", role: "PM"})`,
      `CREATE (p:Project {name: "Hackathon App", status: "Active"})`,
      `MATCH (a:Person {name: "Alice"}), (b:Person {name: "Bob"})
       CREATE (a)-[:COLLABORATES_WITH]->(b)`,
      `MATCH (a:Person {name: "Alice"}), (p:Project {name: "Hackathon App"})
       CREATE (a)-[:WORKS_ON]->(p)`,
      `MATCH (b:Person {name: "Bob"}), (p:Project {name: "Hackathon App"})
       CREATE (b)-[:WORKS_ON]->(p)`,
    ];

    for (const cypher of seedQueries) {
      await runQuery(cypher);
    }

    res.json({ ok: true, data: { message: "Seed data created", nodesSeeded: 7 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "GRAPH_SEED_FAILED", message },
    });
  }
});

// GET /api/graph/health — Graph DB connectivity check
router.get("/health", async (_req: Request, res: Response) => {
  const connected = await verifyConnection();
  res.json({
    ok: true,
    data: { connected },
  });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add graph routes (query, seed, health)"
```

---

### Task 7: Server AI routes

**Files:**
- Create: `packages/server/src/routes/ai.ts`

- [ ] **Step 1: Create `packages/server/src/routes/ai.ts`**

```typescript
import { Router, Request, Response } from "express";
import { askAI, isConfigured } from "../services/ai/llm.js";
import { runQuery } from "../services/graph/neo4j.js";

const router = Router();

// POST /api/ai/ask — Ask AI with optional graph context
router.post("/ask", async (req: Request, res: Response) => {
  try {
    const { prompt, useGraphContext } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_INPUT", message: "prompt field is required" },
      });
      return;
    }

    if (!apiKey || !isConfigured(apiKey)) {
      res.status(503).json({
        ok: false,
        error: {
          code: "AI_NOT_CONFIGURED",
          message: "OPENAI_API_KEY is not set or is a placeholder. Copy .env.example to .env and add your key.",
        },
      });
      return;
    }

    let context: string | undefined;
    if (useGraphContext) {
      try {
        const result = await runQuery(
          "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50"
        );
        context = JSON.stringify(result.records.slice(0, 10));
      } catch {
        context = "Graph database unavailable";
      }
    }

    const answer = await askAI(apiKey, prompt, context);
    res.json({ ok: true, data: { answer } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "AI_QUERY_FAILED", message },
    });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add AI routes (ask, graph context)"
```

---

### Task 8: Server bootstrap (Express app + API router)

**Files:**
- Create: `packages/server/src/routes/api.ts`
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: Create `packages/server/src/routes/api.ts`**

```typescript
import { Router } from "express";
import graphRouter from "./graph.js";
import aiRouter from "./ai.js";

const router = Router();

router.use("/graph", graphRouter);
router.use("/ai", aiRouter);

// GET /api/health
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    data: {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
```

- [ ] **Step 2: Create `packages/server/src/index.ts`**

```typescript
import express from "express";
import cors from "cors";
import pino from "pino";
import apiRouter from "./routes/api.js";
import { createDriver, closeDriver, verifyConnection } from "./services/graph/neo4j.js";

const logger = pino({ name: "server" });
const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(cors({ origin: ["http://localhost:5173"] }));
app.use(express.json());

// Mount API routes
app.use("/api", apiRouter);

// Start server
async function start() {
  // Initialize Neo4j
  const neo4jUri = process.env.NEO4J_URI ?? "bolt://localhost:7687";
  const neo4jUser = process.env.NEO4J_USER ?? "neo4j";
  const neo4jPassword = process.env.NEO4J_PASSWORD ?? "password";

  createDriver({ uri: neo4jUri, user: neo4jUser, password: neo4jPassword });

  const neo4jConnected = await verifyConnection();
  if (neo4jConnected) {
    logger.info("Neo4j connected");
  } else {
    logger.warn("Neo4j not available — start with `docker compose up -d neo4j`");
  }

  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeDriver();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await closeDriver();
  process.exit(0);
});
```

- [ ] **Step 3: Quick smoke test**

```bash
cd packages/server && npx tsx src/index.ts &
sleep 2
kill %1 2>/dev/null
```
Expected: Starts without TypeScript errors or import failures.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add Express server bootstrap with API router"
```

---

### Task 9: Client scaffolding (package, Vite, Tailwind, configs)

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/index.html`

- [ ] **Step 1: Create `packages/client/package.json`**

```json
{
  "name": "@gi-hack/client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gi-hack/shared": "*",
    "@tanstack/react-router": "^1.114.29",
    "@tanstack/react-query": "^5.72.2",
    "@tanstack/react-query-devtools": "^5.72.2",
    "@tanstack/react-router-devtools": "^1.114.29",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.4",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "tailwindcss": "^4.1.4",
    "typescript": "^5.8.3",
    "vite": "^6.3.2"
  }
}
```

- [ ] **Step 2: Create `packages/client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "noUnusedLocals": false
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Create `packages/client/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create `packages/client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gi-Hack — AI Graph TanStack Boilerplate</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: add client package config (Vite, Tailwind, React)"
```

---

### Task 10: Client lib — API, Graph, AI hooks

**Files:**
- Create: `packages/client/src/lib/api.ts`
- Create: `packages/client/src/lib/graph.ts`
- Create: `packages/client/src/lib/ai.ts`

- [ ] **Step 1: Create `packages/client/src/lib/api.ts`**

```typescript
import { QueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@gi-hack/shared";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<ApiResponse<T>>;
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(path);
  return res.json() as Promise<ApiResponse<T>>;
}
```

- [ ] **Step 2: Create `packages/client/src/lib/graph.ts`**

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiPost, apiGet, queryClient } from "./api";
import type { GraphQueryResult } from "@gi-hack/shared";

export function useGraphHealth() {
  return useQuery({
    queryKey: ["graph", "health"],
    queryFn: () => apiGet<{ connected: boolean }>("/api/graph/health"),
  });
}

export function useGraphQuery() {
  return useMutation({
    mutationFn: (cypher: string) =>
      apiPost<{ records: unknown[]; summary: unknown }>("/api/graph/query", {
        cypher,
      }),
  });
}

export function useGraphSeed() {
  return useMutation({
    mutationFn: () => apiPost<{ message: string; nodesSeeded: number }>("/api/graph/seed", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}
```

- [ ] **Step 3: Create `packages/client/src/lib/ai.ts`**

```typescript
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "./api";

export function useAskAI() {
  return useMutation({
    mutationFn: (params: { prompt: string; useGraphContext?: boolean }) =>
      apiPost<{ answer: string }>("/api/ai/ask", params),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add client API lib (Query client, graph hooks, AI hooks)"
```

---

### Task 11: Client routes — Root layout, Landing, Graph, Chat

**Files:**
- Create: `packages/client/src/routes/__root.tsx`
- Create: `packages/client/src/routes/index.tsx`
- Create: `packages/client/src/routes/graph.lazy.tsx`
- Create: `packages/client/src/routes/chat.lazy.tsx`

- [ ] **Step 1: Create `packages/client/src/routes/__root.tsx`**

```typescript
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <Link to="/" className="font-bold text-lg text-cyan-400">
          Gi-Hack
        </Link>
        <Link to="/graph" className="text-gray-400 hover:text-white transition-colors">
          Graph
        </Link>
        <Link to="/chat" className="text-gray-400 hover:text-white transition-colors">
          Chat
        </Link>
      </nav>
      <main className="max-w-6xl mx-auto p-6">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  ),
});
```

- [ ] **Step 2: Create `packages/client/src/routes/index.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useGraphHealth } from "../lib/graph";
import { useAskAI } from "../lib/ai";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: health } = useGraphHealth();

  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">
          AI + Graph + <span className="text-cyan-400">TanStack</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Boilerplate ready for the StartMiUp Hackathon. Neo4j backend, AI
          integration, type-safe React frontend.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">Graph Explorer</h2>
          <p className="text-gray-400 text-sm mb-3">
            Query your Neo4j database with Cypher, see results in real time.
          </p>
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${health?.data?.connected ? "bg-green-400" : "bg-red-400"}`}
          />
          <span className="text-xs text-gray-500">
            Neo4j {health?.data?.connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">AI Chat</h2>
          <p className="text-gray-400 text-sm mb-3">
            Chat with AI leveraging graph context for smarter answers.
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">Type-Safe Routes</h2>
          <p className="text-gray-400 text-sm mb-3">
            TanStack Router with full type safety across all pages.
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Quick Start</h2>
        <pre className="text-sm text-green-400 bg-gray-950 p-4 rounded overflow-x-auto">
{`docker compose up -d neo4j
cp .env.example .env   # Add your OpenAI key
npm install
npm run dev`}
        </pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `packages/client/src/routes/graph.lazy.tsx`**

```typescript
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useGraphQuery, useGraphSeed } from "../lib/graph";

export const Route = createLazyFileRoute("/graph")({
  component: GraphPage,
});

function GraphPage() {
  const [cypher, setCypher] = useState("MATCH (n) RETURN n LIMIT 25");
  const query = useGraphQuery();
  const seed = useGraphSeed();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Graph Explorer</h1>

      <div className="flex gap-2">
        <input
          type="text"
          value={cypher}
          onChange={(e) => setCypher(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500"
          placeholder="MATCH (n) RETURN n LIMIT 25"
        />
        <button
          onClick={() => query.mutate(cypher)}
          disabled={query.isPending}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {query.isPending ? "Running..." : "Run"}
        </button>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors"
        >
          {seed.isPending ? "Seeding..." : "Seed Data"}
        </button>
      </div>

      {query.isError && (
        <div className="bg-red-900/50 border border-red-800 rounded p-4 text-sm">
          Error: {query.error?.message ?? "Query failed"}
        </div>
      )}

      {query.isSuccess && (
        <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-xs overflow-auto max-h-96">
          {JSON.stringify(query.data.data, null, 2)}
        </pre>
      )}

      {seed.isSuccess && (
        <div className="bg-green-900/50 border border-green-800 rounded p-3 text-sm">
          {seed.data.data?.message} ({seed.data.data?.nodesSeeded} relationships created)
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `packages/client/src/routes/chat.lazy.tsx`**

```typescript
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAskAI } from "../lib/ai";

export const Route = createLazyFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [useGraph, setUseGraph] = useState(false);
  const ask = useAskAI();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    ask.mutate({ prompt, useGraphContext: useGraph });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">AI Chat</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="Ask anything... (e.g., 'What do you know about our hackathon team?')"
        />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useGraph}
              onChange={(e) => setUseGraph(e.target.checked)}
              className="accent-cyan-500"
            />
            Include graph context
          </label>

          <button
            type="submit"
            disabled={ask.isPending || !prompt.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 ml-auto px-6 py-2 rounded text-sm font-medium transition-colors"
          >
            {ask.isPending ? "Thinking..." : "Ask AI"}
          </button>
        </div>
      </form>

      {ask.isError && (
        <div className="bg-red-900/50 border border-red-800 rounded p-4 text-sm">
          Error: {ask.error?.message ?? "AI request failed"}
        </div>
      )}

      {ask.isSuccess && (
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <div className="text-xs text-gray-500 mb-2">AI Response:</div>
          <div className="text-sm whitespace-pre-wrap">{ask.data.data?.answer}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add client routes (root layout, landing, graph, chat)"
```

---

### Task 12: Client entry point + route tree

**Files:**
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/routeTree.gen.ts`
- Create: `packages/client/src/index.css`

- [ ] **Step 1: Create `packages/client/src/index.css`**

```css
@import "tailwindcss";

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Create `packages/client/src/routeTree.gen.ts`**

```typescript
import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root";
import { Route as indexRoute } from "./routes/index";
import { Route as graphLazyRoute } from "./routes/graph.lazy";
import { Route as chatLazyRoute } from "./routes/chat.lazy";

const routeTree = rootRoute.addChildren([
  indexRoute,
  graphLazyRoute,
  chatLazyRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 3: Create `packages/client/src/main.tsx`**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { router } from "./routeTree.gen";
import { queryClient } from "./lib/api";
import "./index.css";

const rootElement = document.getElementById("root")!;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 4: Verify client files exist**

```bash
ls -la packages/client/src/main.tsx packages/client/src/routeTree.gen.ts packages/client/src/index.css
```
Expected: All 3 files exist.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add client entry point + manual route tree"
```

---

### Task 13: README + Quickstart

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "docs: add README with quickstart and project overview"
```

---

### Final Verification

- [ ] **Verify TypeScript compiles cleanly**

```bash
npm install && npm run typecheck 2>&1
```
Expected: Clean exit (no type errors).

- [ ] **Verify client Vite dev server starts**

```bash
cd packages/client && npx vite --port 5173 &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1 2>/dev/null
```
Expected: Returns HTML with `<div id="root">`.

- [ ] **Verify server starts (without Neo4j — graceful degradation)**

```bash
cd packages/server && timeout 5 npx tsx src/index.ts 2>&1 || true
```
Expected: Logs "Neo4j not available" warning, server starts.

- [ ] **Push final state**

```bash
git log --oneline
echo "Implementation complete. Verify with: npm run dev (requires docker + .env)"
```

---

### Post-Implementation: GitHub Repo

After all tasks pass verification:

- [ ] **Create private repo on GitHub under tobias-weiss-ai-xr**

```bash
gh repo create gi-hack --private --source=. --remote=origin --push
```

- [ ] **Verify push succeeded**

```bash
git log --oneline | head -5
gh repo view tobias-weiss-ai-xr/gi-hack
```
Expected: Latest commits visible on GitHub.
