import { useState, useEffect, useRef } from "react";
import { useGraphQuery, useGraphSeed } from "../lib/graph";

interface GraphNode {
  id: string;
  label: string;
  color: string;
  type: "node" | "relationship";
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export function GraphPage() {
  const [cypher, setCypher] = useState("MATCH (c:Company)-[:HAS_SIGNAL]->(s:Signal) RETURN c, s LIMIT 30");
  const query = useGraphQuery();
  const seed = useGraphSeed();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const raw = query.data as Record<string, unknown>;
    const responseData = raw?.data as Record<string, unknown> | undefined;
    if (!responseData?.records || !Array.isArray(responseData.records)) {
      setGraphData(null);
      return;
    }

    const records = responseData.records as Record<string, unknown>[];
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const colors = ["#6366f1", "#22c55e", "#f97316", "#eab308", "#60a5fa", "#a855f7", "#ec4899"];

    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (typeof value !== "object" || value === null) continue;
        const obj = value as Record<string, unknown>;

        if (obj.labels && obj.identity != null) {
          const id = String(obj.identity);
          if (!nodes.has(id)) {
            const labels = (obj.labels as string[]) || [];
            const props = (obj.properties || {}) as Record<string, unknown>;
            const name = String(props.name || props.title || props.label || labels[0] || id);
            const colorIdx = Math.abs(hashCode(id)) % colors.length;
            nodes.set(id, {
              id, label: name, color: colors[colorIdx], type: "node",
              x: Math.random() * 600 + 100, y: Math.random() * 400 + 50, vx: 0, vy: 0,
            });
          }
        }

        if (obj.type && obj.start != null && obj.end != null) {
          edges.push({
            source: String(obj.start),
            target: String(obj.end),
            label: String(obj.type),
          });
        }
      }
    }

    setGraphData({ nodes: Array.from(nodes.values()), edges });
  }, [query.data]);

  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;

    const nodes = graphData.nodes;
    const edges = graphData.edges;
    let running = true;

    const step = () => {
      if (!running) return;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 5000 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      for (const edge of edges) {
        const source = nodes.find((n) => n.id === edge.source);
        const target = nodes.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 150) * 0.01;
        source.vx += (dx / dist) * force;
        source.vy += (dy / dist) * force;
        target.vx -= (dx / dist) * force;
        target.vy -= (dy / dist) * force;
      }

      for (const node of nodes) {
        node.vx += (400 - node.x) * 0.001;
        node.vy += (250 - node.y) * 0.001;
        node.vx *= 0.95;
        node.vy *= 0.95;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(50, Math.min(750, node.x));
        node.y = Math.max(30, Math.min(470, node.y));
      }

      if (running) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [graphData]);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: "0 0 16px" }}>Graph Explorer</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={cypher}
          onChange={(e) => setCypher(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: "#161b27",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#ccc",
            outline: "none",
          }}
          placeholder="MATCH (c:Company)-[:HAS_SIGNAL]->(s:Signal) RETURN c, s LIMIT 30"
          onKeyDown={(e) => { if (e.key === "Enter") query.mutate(cypher); }}
        />
        <button
          onClick={() => query.mutate(cypher)}
          disabled={query.isPending}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.4)",
            backgroundColor: query.isPending ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.18)",
            color: query.isPending ? "#555" : "#a5b4fc",
            fontSize: 13,
            fontWeight: 700,
            cursor: query.isPending ? "not-allowed" : "pointer",
          }}
        >
          {query.isPending ? "Running..." : "Run"}
        </button>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid rgba(34,197,94,0.3)",
            backgroundColor: seed.isPending ? "rgba(34,197,94,0.04)" : "rgba(34,197,94,0.08)",
            color: seed.isPending ? "#555" : "#86efac",
            fontSize: 13,
            fontWeight: 600,
            cursor: seed.isPending ? "not-allowed" : "pointer",
          }}
        >
          {seed.isPending ? "Seeding..." : "Seed Data"}
        </button>
      </div>

      {query.isError && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 12,
          color: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.15)",
          marginBottom: 16,
        }}>
          Error: {(query.error as Error)?.message ?? "Query failed"}
        </div>
      )}

      {query.isSuccess && graphData && graphData.nodes.length > 0 && (
        <div style={{
          backgroundColor: "#0d1117",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          marginBottom: 16,
        }}>
          <svg ref={svgRef} width="800" height="500" style={{ display: "block" }}>
            {graphData.edges.map((edge, i) => {
              const source = graphData.nodes.find((n) => n.id === edge.source);
              const target = graphData.nodes.find((n) => n.id === edge.target);
              if (!source || !target) return null;
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2;
              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={source.x} y1={source.y}
                    x2={target.x} y2={target.y}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                  />
                  <text
                    x={midX} y={midY - 6}
                    fill="rgba(255,255,255,0.35)"
                    fontSize={8}
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}
            {graphData.nodes.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x} cy={node.y} r={20}
                  fill={node.color}
                  fillOpacity={0.3}
                  stroke={node.color}
                  strokeWidth={2}
                />
                <text
                  x={node.x} y={node.y + 4}
                  fill="#e0e0e0"
                  fontSize={10}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontWeight={600}
                >
                  {node.label.length > 12 ? node.label.slice(0, 12) + "…" : node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {query.isSuccess && (!graphData || graphData.nodes.length === 0) && (
        <pre style={{
          backgroundColor: "#161b27",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: 16,
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: "#888",
          overflow: "auto",
          maxHeight: 400,
          whiteSpace: "pre-wrap",
        }}>
          {JSON.stringify(query.data, null, 2)}
        </pre>
      )}

      {seed.isSuccess && (
        <div style={{
          marginTop: 16,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 12,
          color: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.15)",
        }}>
          ✓ Seed completed
        </div>
      )}
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
