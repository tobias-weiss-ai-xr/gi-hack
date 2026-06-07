import { describe, it, expect, vi, beforeEach } from "vitest";
import { MDALLAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/mdall.js";

describe("MDALLAdapter", () => {
  let adapter: MDALLAdapter;

  beforeEach(() => {
    adapter = new MDALLAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("mdall");
    expect(adapter.name).toContain("Canada");
    expect(adapter.description).toContain("Health Canada");
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

  it("should normalize a sample MDALL record correctly", () => {
    const raw = {
      sourceId: "mdall-12345",
      sourceUrl: "https://health-products.canada.ca/mdall-licence/12345",
      raw: {
        licence_number: "12345",
        company_name: "Bio-Rad Laboratories (Canada) Ltd.",
        licence_name: "SARS-CoV-2 Antigen Detection Kit",
        status: "ACTIVE",
        issue_date: "2024-01-15",
        device_identifier: "DEV-001",
        device_name: "COVID-19 Rapid Antigen Test",
        manufacturer_name: "Bio-Rad Laboratories",
        _assignedApplication: "Infectious Disease & Serology",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.companyName).toBe("Bio-Rad Laboratories (Canada) Ltd.");
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe("MDALL_CLEARANCE");
    expect(result.signals[0].confidence).toBe(0.85);
    expect(result.signals[0].date).toBe("2024-01-15");
    expect(result.applicationAreas).toContain("Infectious Disease & Serology");
  });

  it("should handle missing optional fields gracefully", () => {
    const raw = {
      sourceId: "mdall-99999",
      sourceUrl: "https://health-products.canada.ca/mdall-licence/99999",
      raw: {
        licence_number: "99999",
        company_name: "TestCo",
        licence_name: "Test Device",
        status: "ACTIVE",
        issue_date: "",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.companyName).toBe("TestCo");
    expect(result.signals[0].date).toBeTruthy();
  });

  it("should skip records with empty company_name", async () => {
    const mockResponse = [
      { licence_number: "1", company_name: "", licence_name: "Test", status: "ACTIVE", issue_date: "2024-01-01" },
      { licence_number: "2", company_name: "Valid Corp", licence_name: "Test 2", status: "ACTIVE", issue_date: "2024-01-02" },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);
    const result = await adapter.fetch();
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("mdall-2");
  });

  it("healthCheck returns false on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(false);
  });

  it("healthCheck returns true on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(true);
  });
});
