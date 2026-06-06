import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { queryRows, runQuery } from "../neo4j.js";

export type CompanySegment = "IVD_MANUFACTURER" | "CDMO" | "SUPPLIER" | "RESEARCH" | null;

const CLASSIFICATION_PROMPT = `You are a B2B lead scoring system for Siemens Healthineers.
Classify the company into exactly one of these segments:
- IVD_MANUFACTURER
- CDMO
- SUPPLIER
- RESEARCH

Respond with ONLY the segment label, nothing else. If unsure, respond with "UNKNOWN".

Company: {{companyName}}
Description: {{description}}`;

export async function classifyCompanySegment(
  companyName: string,
  description: string
): Promise<CompanySegment> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;

  const openai = createOpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL,
  });

  const model = openai(process.env.LLM_MODEL || "deepseek-v4-flash");

  const prompt = CLASSIFICATION_PROMPT
    .replace("{{companyName}}", companyName)
    .replace("{{description}}", description || "No description available");

  try {
    const { text } = await generateText({ model, prompt });
    const label = text.trim().toUpperCase().replace(/[^A-Z_]/g, "");
    if (["IVD_MANUFACTURER", "CDMO", "SUPPLIER", "RESEARCH"].includes(label)) {
      return label as CompanySegment;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ClassifyResult {
  classified: number;
  failed: number;
}

export async function classifyAllSegments(options?: {
  limit?: number;
  concurrency?: number;
}): Promise<ClassifyResult> {
  const limit = options?.limit ?? 200;
  const concurrency = options?.concurrency ?? 5;

  const companies = await queryRows(
    `MATCH (c:Company)
     WHERE c.segment IS NULL
     RETURN c.name AS name, c.description AS description
     ORDER BY c.name
     LIMIT $limit`,
    { limit: { low: limit, high: 0 } }
  );

  let classified = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i += concurrency) {
    const batch = companies.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((c: any) =>
        classifyCompanySegment(c.name as string, (c.description as string) ?? "")
          .then(async (segment) => {
            if (segment) {
              await runQuery(
                `MATCH (c:Company {name: $name})
                 SET c.segment = $segment`,
                { name: c.name, segment }
              );
              classified++;
            }
          })
      )
    );
    for (const r of results) {
      if (r.status === "rejected") failed++;
    }
  }

  return { classified, failed };
}
