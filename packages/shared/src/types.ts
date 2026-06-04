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
