import { runQuery } from "../neo4j.js";
import { SourceAdapter, SourceConfig, LeadCandidate, IngestionSummary } from "./types.js";

function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9äöüß\s-]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateCandidates(candidates: LeadCandidate[]): LeadCandidate[] {
  const seen = new Map<string, LeadCandidate>();
  for (const c of candidates) {
    const key = `${normalizeCompanyName(c.companyName)}::${c.sourceId}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

async function upsertCompany(lead: LeadCandidate): Promise<void> {
  await runQuery(
    `MERGE (c:Company {name: $name})
     SET c.domain = COALESCE(c.domain, $domain),
         c.description = COALESCE(c.description, $description)`,
    { name: lead.companyName, domain: lead.domain ?? null, description: lead.description ?? null }
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
    const sorted = Array.from(this.pool.entries())
      .filter(([, e]) => e.config.enabled)
      .sort(([, a], [, b]) => b.config.weight - a.config.weight);

    const results: IngestionSummary[] = [];
    const running = new Set<Promise<void>>();

    for (const [id] of sorted) {
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
