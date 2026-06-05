import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface PatentRecord {
  companyName: string;
  domain: string;
  description: string;
  applicationAreas: string[];
  patentTitle: string;
  patentId: string;
  filingDate: string;
  ipcCodes: string[];
}

const PATENTS: PatentRecord[] = [
  {
    companyName: "ASKA Pharmaceutical Co., Ltd.",
    domain: "aska-pharma.co.jp",
    description: "Japanese pharmaceutical — novel coagulation factor VIIa assay",
    applicationAreas: ["Hemostasis & Thrombosis"],
    patentTitle: "Method for measuring coagulation factor VIIa activity in plasma samples",
    patentId: "EP2025-001",
    filingDate: "2025-10-01",
    ipcCodes: ["G01N33/86", "C12Q1/56"],
  },
  {
    companyName: "Mikrogen GmbH",
    domain: "mikrogen.de",
    description: "German diagnostics — recombinant antigen expression for serology",
    applicationAreas: ["Infectious Disease & Serology"],
    patentTitle: "Recombinant antigen expression system for Borrelia immunoblot assays",
    patentId: "DE2025-002",
    filingDate: "2025-05-30",
    ipcCodes: ["C07K14/20", "G01N33/569"],
  },
  {
    companyName: "IBL International GmbH",
    domain: "ibl-international.com",
    description: "German immunodiagnostics — neurological autoimmune markers",
    applicationAreas: ["Autoimmune Diagnostics"],
    patentTitle: "Biomarker panel for neurological autoimmune disease detection",
    patentId: "EP2025-003",
    filingDate: "2025-08-20",
    ipcCodes: ["G01N33/564", "G01N33/68"],
  },
  {
    companyName: "Hycor Biomedical",
    domain: "hycorbiomedical.com",
    description: "US autoimmune diagnostics — autoimmune diagnostic panel",
    applicationAreas: ["Autoimmune Diagnostics"],
    patentTitle: "Multiplex autoimmune diagnostic panel using novel antigen substrates",
    patentId: "US2025-004",
    filingDate: "2025-07-01",
    ipcCodes: ["G01N33/543", "G01N33/564"],
  },
  {
    companyName: "DRG Instruments GmbH",
    domain: "drg-diagnostics.de",
    description: "German ELISA manufacturer — tumor marker immunoassay",
    applicationAreas: ["Oncology & Tumor Markers"],
    patentTitle: "Stabilized conjugate formulation for tumor marker ELISA assays",
    patentId: "EP2025-005",
    filingDate: "2025-06-15",
    ipcCodes: ["G01N33/574", "C07K16/30"],
  },
];

export class PatentStubAdapter implements SourceAdapter {
  readonly id = "patent";
  readonly name = "Patent Filings (Stub)";
  readonly description = "Simulated diagnostic patent filings from European and US companies";

  async fetch(): Promise<RawLead[]> {
    return PATENTS.map((p, i) => ({
      sourceId: `pat-${i + 1}`,
      sourceUrl: `https://patents.google.com/patent/${p.patentId}`,
      raw: p as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const p = raw.raw as unknown as PatentRecord;
    const signals: Signal[] = [
      {
        type: "PATENT",
        date: p.filingDate,
        confidence: 0.75,
        description: `${p.patentTitle} (${p.patentId}, IPC: ${p.ipcCodes.join(", ")})`,
        url: raw.sourceUrl,
      },
    ];
    return {
      sourceId: raw.sourceId,
      companyName: p.companyName,
      domain: p.domain,
      description: p.description,
      applicationAreas: p.applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
