import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const MDALL_API = "https://health-products.canada.ca/api/medical-devices/licences";

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
  licence_number: string;
  company_name: string;
  licence_name: string;
  status: string;
  issue_date: string;
  device_identifier?: string;
  device_name?: string;
  manufacturer_name?: string;
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

export class MDALLAdapter implements SourceAdapter {
  readonly id = "mdall";
  readonly name = "Canada MDALL";
  readonly description = "Health Canada Medical Devices Active Licence Listing — licensed medical device companies";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenLicences = new Set<string>();

    for (const filter of CATEGORY_FILTERS) {
      try {
        const url = `${MDALL_API}?keyword=${filter.keyword}&status=ACTIVE&limit=100`;
        const res = await fetch(url, {
          headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as MDALLRecord[];
        const records = Array.isArray(data) ? data : [];
        for (const record of records) {
          if (seenLicences.has(record.licence_number)) continue;
          seenLicences.add(record.licence_number);
          if (!record.company_name) continue;

          allLeads.push({
            sourceId: `mdall-${record.licence_number}`,
            sourceUrl: `https://health-products.canada.ca/mdall-licence/${record.licence_number}`,
            raw: {
              ...record,
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
    const issueDate = r.issue_date as string;
    const deviceName = r.device_name as string ?? "";

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
      const res = await fetch(`${MDALL_API}?keyword=diagnostic&limit=1`, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
