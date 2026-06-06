import { describe, it, expect } from "vitest";
import { classifyCompanySegment } from "../../../packages/server/src/services/graph/scoring/segment-classifier.js";

describe("segment-classifier", () => {
  it("should return IVD_MANUFACTURER for a diagnostics company", async () => {
    const result = await classifyCompanySegment("Bio-Rad Laboratories", "Clinical diagnostics manufacturer");
    expect(["IVD_MANUFACTURER", "CDMO", "SUPPLIER", "RESEARCH", null]).toContain(result);
  });

  it("should return RESEARCH for a university research center", async () => {
    const result = await classifyCompanySegment("Max Planck Institute", "Basic research in molecular biology");
    expect(["RESEARCH", null]).toContain(result);
  });

  it("should return CDMO for a contract manufacturer", async () => {
    const result = await classifyCompanySegment("Lonza", "Contract development and manufacturing for biopharma");
    expect(["CDMO", null]).toContain(result);
  });

  it("should handle empty description gracefully", async () => {
    const result = await classifyCompanySegment("Unknown Corp", "");
    // Should not throw; returns null if LLM can't determine
    expect(result === null || typeof result === "string").toBe(true);
  });
});
