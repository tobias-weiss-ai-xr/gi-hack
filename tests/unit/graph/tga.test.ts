import { describe, it, expect, vi, beforeEach } from "vitest";
import { TGAAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/tga.js";

describe("TGAAdapter", () => {
  let adapter: TGAAdapter;

  beforeEach(() => {
    adapter = new TGAAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("tga");
    expect(adapter.name).toContain("Australia");
    expect(adapter.description).toContain("Australian Register");
  });

  it("should return empty array on fetch network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should return empty array on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should normalize a sample TGA record correctly", () => {
    const raw = {
      sourceId: "tga-123456",
      sourceUrl: "https://www.tga.gov.au/artg/123456",
      raw: {
        companyName: "ResMed Australia Pty Ltd",
        productName: "Sleep Apnea Diagnostic Device",
        artgNumber: "123456",
        category: "Class IIa",
        approvalDate: "2023-11-01",
        applicationArea: "Cardiac Markers",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe("TGA_CLEARANCE");
    expect(result.signals[0].confidence).toBe(0.85);
    expect(result.companyName).toBe("ResMed Australia Pty Ltd");
    expect(result.applicationAreas).toContain("Cardiac Markers");
    expect(result.signals[0].date).toBe("2023-11-01");
  });

  it("should handle missing optional fields gracefully", () => {
    const raw = {
      sourceId: "tga-999999",
      sourceUrl: "https://www.tga.gov.au/artg/999999",
      raw: {
        companyName: "Test Diagnostics Ltd",
        productName: "Test Kit",
        artgNumber: "999999",
        category: "Class I",
        approvalDate: "",
        applicationArea: "Infectious Disease & Serology",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.companyName).toBe("Test Diagnostics Ltd");
    expect(result.signals[0].date).toBeTruthy();
  });

  it("healthCheck returns false on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(false);
  });

  it("healthCheck returns true on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Results: [{ ARTGNumber: "123" }] }),
    } as Response);
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(true);
  });

  it("should skip non-diagnostic records", async () => {
    // TGA adapter filters: EntryType="Medical Device Included", GMDNTerm matching diagnostic terms
    const mockData = {
      Results: [
        {
          ARTGNumber: "1",
          EntryType: "Medical Device Included",
          Sponsor: { Name: "Active Co" },
          ApprovalDate: "2024-01-01",
          Products: [{ GMDNTerm: "Reagent for diagnostic use" }],
        },
        {
          ARTGNumber: "2",
          EntryType: "Medical Device Included",
          Sponsor: { Name: "Other Co" },
          ApprovalDate: "2024-01-02",
          Products: [{ GMDNTerm: "Surgical instrument" }],
        },
        {
          ARTGNumber: "3",
          EntryType: "Medical Device Included",
          Sponsor: { Name: "Dx Co" },
          ApprovalDate: "2024-01-03",
          Products: [{ GMDNTerm: "In vitro diagnostic test kit" }],
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);
    const result = await adapter.fetch();
    // Only records 1 and 3 have diagnostic-related GMDN terms
    expect(result).toHaveLength(2);
  });
});
