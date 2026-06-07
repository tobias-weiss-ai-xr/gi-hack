import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const MDALL_API = "https://health-products.canada.ca/api/medical-devices";

const CATEGORY_FILTERS = [
  { keyword: "diagnostic", application: "Infectious Disease & Serology" },
  { keyword: "assay", application: "Specialty Proteins & Reagents" },
  { keyword: "reagent", application: "Specialty Proteins & Reagents" },
  { keyword: "test%20kit", application: "Infectious Disease & Serology" },
  { keyword: "analyzer", application: "Point of Care" },
  { keyword: "immunoassay", application: "Autoimmune Diagnostics" },
  { keyword: "tumor%20marker", application: "Oncology & Tumor Markers" },
  { keyword: "cardiac", application: "Cardiac Markers" },
  { keyword: "coagulation", application: "Hemostasis & Thrombosis" },
];

interface MDALLRecord {
  original_licence_no: number;
  licence_status: string;
  licence_name: string;
  first_licence_status_dt: string;
  company_id: number;
  device_name?: string;
  end_date?: string;
}

function classifyApplication(deviceName: string, licenceName: string): string {
  const text = `${deviceName} ${licenceName}`.toLowerCase();
  if (/immunoassay|elisa|serolog|infectious|antibody|antigen|pathogen|virus|bacterial/.test(text))
    return "Infectious Disease & Serology";
  if (/tumor|cancer|oncology|biomarker/.test(text))
    return "Oncology & Tumor Markers";
  if (/cardiac|heart|troponin|bnp/.test(text))
    return "Cardiac Markers";
  if (/coagulation|hemostasis|thrombosis|clotting|d-dimer/.test(text))
    return "Hemostasis & Thrombosis";
  if (/autoimmune|rheumat|lupus|celiac/.test(text))
    return "Autoimmune Diagnostics";
  if (/point.of.care|rapid|lateral.flow|poc/.test(text))
    return "Point of Care";
  return "Infectious Disease & Serology";
}

const companyNameCache = new Map<number, string | null>();

async function resolveCompanyName(companyId: number): Promise<string | null> {
  if (companyNameCache.has(companyId)) return companyNameCache.get(companyId) ?? null;

  try {
    const url = `${MDALL_API}/company?company_id=${companyId}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ company_name: string }>;
    const company = Array.isArray(data) && data.length > 0 ? data[0] : null;
    const name = company?.company_name ?? null;
    if (name) companyNameCache.set(companyId, name);
    return name;
  } catch {
    return null;
  }
}

export class MDALLAdapter implements SourceAdapter {
  readonly id = "mdall";
  readonly name = "Canada MDALL";
  readonly description = "Health Canada Medical Devices Active Licence Listing — licensed medical device companies";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenLicences = new Set<number>();

    for (const filter of CATEGORY_FILTERS) {
      try {
        // Status D = Distributed (Active) in Health Canada's MDALL system
        const url = `${MDALL_API}/licence?keyword=${filter.keyword}&status=D&limit=100`;
        const res = await fetch(url, {
          headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as MDALLRecord[];
        const records = Array.isArray(data) ? data : [];
        for (const record of records) {
            if (seenLicences.has(record.original_licence_no)) continue;
          seenLicences.add(record.original_licence_no);
          if (record.licence_status !== "D") continue;

          const companyName = await resolveCompanyName(record.company_id);
          if (!companyName) continue;

          allLeads.push({
            sourceId: `mdall-${record.original_licence_no}`,
            sourceUrl: `https://health-products.canada.ca/mdall-licence/${record.original_licence_no}`,
            raw: {
              ...record,
              company_name: companyName,
              _assignedApplication: filter.application,
            } as unknown as Record<string, unknown>,
          });
        }
      } catch {
        continue;
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.company_name as string;
    const licenceName = r.licence_name as string;
    const issueDate = r.first_licence_status_dt as string;
    const deviceName = (r.device_name as string) ?? "";

    const appArea = deviceName
      ? classifyApplication(deviceName, licenceName)
      : classifyApplication(licenceName, "");

    const signals: Signal[] = [
      {
        type: "MDALL_CLEARANCE",
        date: issueDate || new Date().toISOString().slice(0, 10),
        confidence: 0.85,
        description: `Canada MDALL: ${licenceName}${deviceName ? ` — ${deviceName}` : ""}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      description: `Canada medical device licence`,
      applicationAreas: [appArea],
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${MDALL_API}/licence?keyword=diagnostic&limit=1`, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
