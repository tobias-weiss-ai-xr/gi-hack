import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface FundingRecord {
  companyName: string;
  domain: string;
  description: string;
  applicationAreas: string[];
  round: string;
  amount: string;
  date: string;
  investors: string;
}

const FUNDING: FundingRecord[] = [
  {
    companyName: "SERION Immunologics GmbH",
    domain: "serion-immunologics.de",
    description: "German serology company — Series B for ELISA platform expansion",
    applicationAreas: ["Infectious Disease & Serology", "Autoimmune Diagnostics"],
    round: "Series B",
    amount: "€12M",
    date: "2025-09-01",
    investors: "Bayern Kapital, High-Tech Gründerfonds",
  },
  {
    companyName: "DIARECT AG",
    domain: "diarect.com",
    description: "German autoimmune diagnostics — investment for IVDR certification",
    applicationAreas: ["Autoimmune Diagnostics", "Infectious Disease & Serology"],
    round: "Series A",
    amount: "€8M",
    date: "2025-06-01",
    investors: "BioM AG, Coparion",
  },
  {
    companyName: "Euroimmun AG",
    domain: "euroimmun.com",
    description: "Global autoimmunity leader — PerkinElmer expansion investment",
    applicationAreas: ["Autoimmune Diagnostics", "Infectious Disease & Serology"],
    round: "Corporate Investment",
    amount: "$25M",
    date: "2025-06-01",
    investors: "PerkinElmer Inc.",
  },
  {
    companyName: "Bio-Rad Laboratories",
    domain: "bio-rad.com",
    description: "Global diagnostics — R&D investment for clinical diagnostics division",
    applicationAreas: ["Infectious Disease & Serology", "Cardiac Markers", "Oncology & Tumor Markers"],
    round: "Corporate R&D",
    amount: "$50M",
    date: "2025-06-15",
    investors: "Bio-Rad internal R&D budget",
  },
];

export class FundingStubAdapter implements SourceAdapter {
  readonly id = "funding";
  readonly name = "Funding Activity (Stub)";
  readonly description = "Simulated investment and funding rounds in diagnostics companies";

  async fetch(): Promise<RawLead[]> {
    return FUNDING.map((f, i) => ({
      sourceId: `fund-${i + 1}`,
      sourceUrl: `https://example.com/funding/${f.companyName.toLowerCase().replace(/[^a-z]/g, "-")}`,
      raw: f as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const f = raw.raw as unknown as FundingRecord;
    const signals: Signal[] = [
      {
        type: "FUNDING",
        date: f.date,
        confidence: 0.75,
        description: `${f.round}: ${f.amount} from ${f.investors} for diagnostics expansion`,
        url: raw.sourceUrl,
      },
    ];
    return {
      sourceId: raw.sourceId,
      companyName: f.companyName,
      domain: f.domain,
      description: f.description,
      applicationAreas: f.applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
