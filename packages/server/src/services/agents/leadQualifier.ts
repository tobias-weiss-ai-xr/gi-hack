import { scoreAll } from "../graph/scoring/scorer.js";
import type { ScoredResult } from "../graph/scoring/types.js";

export interface QualifiedLead {
  name: string;
  totalScore: number;
  tier: "HOT" | "WARM";
}

/**
 * Selects top N qualified companies for outreach.
 * Criteria: HOT/WARM tier, no existing Contact, has Signals, no recent outreach.
 * Queries the graph for cooldown/contact checks, uses scorer for tier/score.
 */
export async function qualifyLeads(
  session: any,
  limit = 5,
): Promise<QualifiedLead[]> {
  // 1. Get all scored companies (in-memory tier assignment)
  const scoredCompanies: ScoredResult[] = await scoreAll();

  // 2. Find companies that already have contacts
  const contactCheck = await session.run(
    `MATCH (c:Company)<-[:CONTACT_AT]-(:Contact)
     RETURN c.name AS name`,
  );
  const hasContact = new Set(contactCheck.records.map((r: any) => r.get("name")));

  // 3. Find companies with no signals
  const signalCheck = await session.run(
    `MATCH (c:Company)
     OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
     WITH c, count(s) AS signalCount
     WHERE signalCount = 0
     RETURN c.name AS name`,
  );
  const noSignals = new Set(signalCheck.records.map((r: any) => r.get("name")));

  // 4. Find companies with recent outreach (30-day cooldown)
  const recentOutreachCheck = await session.run(
    `MATCH (c:Company)-[:OUTREACH_SENT]->(o:Outreach)
     WHERE o.date > toString(datetime() - duration('P30D'))
     RETURN c.name AS name`,
  );
  const recentOutreach = new Set(recentOutreachCheck.records.map((r: any) => r.get("name")));

  // 5. Filter, sort, slice
  return scoredCompanies
    .filter((c) => c.tier === "HOT" || c.tier === "WARM")
    .filter((c) => !hasContact.has(c.companyName))
    .filter((c) => !noSignals.has(c.companyName))
    .filter((c) => !recentOutreach.has(c.companyName))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
    .map((c) => ({
      name: c.companyName,
      totalScore: c.totalScore,
      tier: c.tier as "HOT" | "WARM",
    }));
}
