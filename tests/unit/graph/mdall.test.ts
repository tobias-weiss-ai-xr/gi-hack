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
        original_licence_no: 12345,
        company_name: "Bio-Rad Laboratories (Canada) Ltd.",
        licence_name: "SARS-CoV-2 Antigen Detection Kit",
        licence_status: "D",
        first_licence_status_dt: "2024-01-15",
        device_name: "COVID-19 Rapid Antigen Test",
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
        original_licence_no: 99999,
        company_name: "TestCo",
        licence_name: "Test Device",
        licence_status: "D",
        first_licence_status_dt: "",
        company_id: 0,
      },
    };
    const result = adapter.normalize(raw);
    expect(result.companyName).toBe("TestCo");
    expect(result.signals[0].date).toBeTruthy();
  });

  it("should skip records with empty company_name", async () => {
    const mockResponse = [
      { original_licence_no: 1, company_name: "", licence_name: "Test", licence_status: "D", first_licence_status_dt: "2024-01-01", company_id: 100 },
      { original_licence_no: 2, company_name: "Valid Corp", licence_name: "Test 2", licence_status: "D", first_licence_status_dt: "2024-01-02", company_id: 101 },
    ];
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ company_name: "Valid Corp" }]),
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
