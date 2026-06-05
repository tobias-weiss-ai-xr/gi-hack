import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const FDA_API = "https://api.fda.gov/device/510k.json";

// Product codes relevant to Siemens Healthineers biological intermediates
const PRODUCT_CODE_FILTERS = [
  { code: "JJY", application: "Hemostasis & Thrombosis", description: "Coagulation reagents" },
  { code: "JIW", application: "Plasma Proteins", description: "Plasma protein tests" },
  { code: "LJO", application: "Infectious Disease & Serology", description: "Infectious disease serology" },
  { code: "JAS", application: "Cardiac Markers", description: "Cardiac marker tests" },
  { code: "MMZ", application: "Oncology & Tumor Markers", description: "Tumor marker tests" },
  { code: "LSP", application: "Autoimmune Diagnostics", description: "Autoimmune diagnostic tests" },
  { code: "JGB", application: "Specialty Proteins & Reagents", description: "Clinical chemistry reagents" },
  { code: "JJQ", application: "Hemostasis & Thrombosis", description: "Coagulation factor tests" },
];

interface FDAResult {
  applicant: string;
  k_number: string;
  device_name: string;
  decision_date: string;
  product_code: string;
  applicant_contact?: string;
  applicant_phone?: string;
}

interface FDAResponse {
  results: FDAResult[];
  error?: { message: string };
  meta?: { results: { total: number } };
}

function normalizeApplicant(name: string): string {
  return name
    .replace(/\s*(INC|LLC|LTD|GMBH|AG|BV|NV|CORP|CO|PLC)\s*\.?\s*$/i, "")
    .replace(/[^a-zA-Z0-9\s.-]/g, "")
    .trim();
}

export class FDA510kAdapter implements SourceAdapter {
  readonly id = "fda-510k";
  readonly name = "FDA 510(k) Database";
  readonly description = "FDA 510(k) premarket notification database — diagnostic device clearances";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];

    for (const filter of PRODUCT_CODE_FILTERS) {
      const url = `${FDA_API}?search=product_code:${filter.code}&limit=100&sort=decision_date:desc`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "LeadGraph/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as FDAResponse;
        if (data.error || !data.results) continue;

        for (const result of data.results) {
          const companyName = normalizeApplicant(result.applicant);
          if (!companyName) continue;

          allLeads.push({
            sourceId: `fda-${result.k_number}`,
            sourceUrl: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${result.k_number}`,
            raw: {
              ...result,
              _application: filter.application,
              _applicationDescription: filter.description,
            } as unknown as Record<string, unknown>,
          });
        }
      } catch {
        // Timeout or network error — skip this product code and continue
        continue;
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = normalizeApplicant(r.applicant as string);
    const applicationArea = r._application as string;
    const deviceName = (r.device_name as string) ?? "";
    const decisionDate = (r.decision_date as string) ?? "";
    const kNumber = (r.k_number as string) ?? "";

    const signals: Signal[] = [
      {
        type: "FDA_CLEARANCE",
        date: decisionDate,
        confidence: 0.85,
        description: `FDA 510(k) ${kNumber}: ${deviceName}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      domain: `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      description: `FDA 510(k) clearance for ${applicationArea} devices`,
      applicationAreas: [applicationArea],
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${FDA_API}?limit=1`, {
        headers: { "User-Agent": "LeadGraph/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
