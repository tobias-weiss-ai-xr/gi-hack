import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface HiringRecord {
  companyName: string;
  domain: string;
  description: string;
  applicationAreas: string[];
  roleTitle: string;
  department: string;
  postedDate: string;
  location: string;
}

const HIRING: HiringRecord[] = [
  {
    companyName: "ASKA Pharmaceutical Co., Ltd.",
    domain: "aska-pharma.co.jp",
    description: "Japanese pharma — expanding hemostasis assay R&D team",
    applicationAreas: ["Hemostasis & Thrombosis"],
    roleTitle: "Senior R&D Scientist — Hemostasis Assay Development",
    department: "Diagnostics R&D",
    postedDate: "2025-08-15",
    location: "Tokyo, Japan",
  },
  {
    companyName: "BioGenes GmbH",
    domain: "biogenes.de",
    description: "German antibody manufacturer — scaling production for diagnostic assays",
    applicationAreas: ["Infectious Disease & Serology", "Plasma Proteins"],
    roleTitle: "Quality Assurance Manager — Diagnostic Antibody Manufacturing",
    department: "Quality",
    postedDate: "2025-11-20",
    location: "Berlin, Germany",
  },
  {
    companyName: "DRG Instruments GmbH",
    domain: "drg-diagnostics.de",
    description: "German ELISA kit manufacturer — expanding commercial team for EMEA",
    applicationAreas: ["Oncology & Tumor Markers", "Infectious Disease & Serology"],
    roleTitle: "International Sales Manager — EMEA Diagnostics Markets",
    department: "Sales",
    postedDate: "2025-10-01",
    location: "Marburg, Germany",
  },
  {
    companyName: "Phadia GmbH",
    domain: "phadia.com",
    description: "ThermoFisher allergy/autoimmune subsidiary — expanding assay pipeline",
    applicationAreas: ["Autoimmune Diagnostics", "Specialty Proteins & Reagents"],
    roleTitle: "R&D Director — Autoimmune Assay Development",
    department: "Research & Development",
    postedDate: "2025-11-15",
    location: "Freiburg, Germany",
  },
  {
    companyName: "Bio-Rad Laboratories",
    domain: "bio-rad.com",
    description: "Global diagnostics leader — expanding immunoassay R&D",
    applicationAreas: ["Infectious Disease & Serology", "Cardiac Markers"],
    roleTitle: "Senior Scientist — Immunoassay Development, Clinical Diagnostics",
    department: "Clinical Diagnostics R&D",
    postedDate: "2025-12-01",
    location: "Hercules, CA, USA",
  },
];

export class HiringStubAdapter implements SourceAdapter {
  readonly id = "hiring";
  readonly name = "Hiring Activity (Stub)";
  readonly description = "Simulated R&D and commercial job postings at diagnostics companies";

  async fetch(): Promise<RawLead[]> {
    return HIRING.map((h, i) => ({
      sourceId: `hire-${i + 1}`,
      sourceUrl: `https://example.com/jobs/${h.companyName.toLowerCase().replace(/[^a-z]/g, "-")}`,
      raw: h as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const h = raw.raw as unknown as HiringRecord;
    const signals: Signal[] = [
      {
        type: "HIRING",
        date: h.postedDate,
        confidence: 0.6,
        description: `Hiring: ${h.roleTitle} in ${h.department}`,
        url: raw.sourceUrl,
      },
    ];
    return {
      sourceId: raw.sourceId,
      companyName: h.companyName,
      domain: h.domain,
      description: h.description,
      applicationAreas: h.applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
