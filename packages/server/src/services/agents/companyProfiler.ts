export type MatchedProductLine = "Hemostasis" | "Plasma Proteins" | "General Diagnostics";

export interface CompanyProfile {
  name: string;
  domain: string;
  segment: string | null;
  tier: "HOT" | "WARM" | "COLD";
  totalScore: number;
  signals: string[];
  applications: string[];
  strongestSignal: string;
  matchedProductLine: MatchedProductLine;
}

export async function buildCompanyProfile(
  session: any,
  company: { name: string; totalScore: number; tier: string },
): Promise<CompanyProfile> {
  const detailResult = await session.run(
    `MATCH (c:Company {name: $name})
     OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
     OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
     RETURN c.domain AS domain, c.segment AS segment,
            collect(DISTINCT s.description) AS signals,
            collect(DISTINCT a.name) AS applications`,
    { name: company.name },
  );

  const record = detailResult.records[0];
  const domain = record?.get("domain") ?? `${company.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
  const segment: string | null = record?.get("segment") ?? null;
  const signals: string[] = (record?.get("signals") ?? []).filter(Boolean);
  const applications: string[] = record?.get("applications") ?? [];

  const strongestSignal = signals[0] || "Recent market activity";
  const matchedProductLine = applications.includes("Hemostasis")
    ? "Hemostasis"
    : applications.includes("Plasma Proteins")
      ? "Plasma Proteins"
      : "General Diagnostics";

  return {
    name: company.name,
    domain,
    segment,
    tier: company.tier as "HOT" | "WARM" | "COLD",
    totalScore: company.totalScore,
    signals,
    applications,
    strongestSignal,
    matchedProductLine,
  };
}
