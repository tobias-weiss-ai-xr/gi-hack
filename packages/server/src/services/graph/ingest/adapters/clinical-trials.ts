import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface TrialRecord {
  companyName: string;
  domain: string;
  description: string;
  applicationAreas: string[];
  phase: string;
  title: string;
  startDate: string;
  trialId: string;
}

const TRIALS: TrialRecord[] = [
  {
    companyName: "Mikrogen GmbH",
    domain: "mikrogen.de",
    description: "German diagnostics company — clinical validation of recombinant antigen panel for Lyme serology",
    applicationAreas: ["Infectious Disease & Serology"],
    phase: "Phase III",
    title: "Clinical validation of recomLine Borrelia IgG/IgM immunoblot assay",
    startDate: "2025-08-01",
    trialId: "NCT-TRIAL-001",
  },
  {
    companyName: "BioGenes GmbH",
    domain: "biogenes.de",
    description: "German antibody developer — clinical evaluation of anti-SARS-CoV-2 antibody panel",
    applicationAreas: ["Infectious Disease & Serology"],
    phase: "Phase II",
    title: "Evaluation of novel monoclonal antibody panel for SARS-CoV-2 antigen detection",
    startDate: "2025-09-15",
    trialId: "NCT-TRIAL-002",
  },
  {
    companyName: "Euroimmun AG",
    domain: "euroimmun.com",
    description: "Autoimmune diagnostics — evaluation of novel autoimmune hepatitis marker panel",
    applicationAreas: ["Autoimmune Diagnostics"],
    phase: "Phase III",
    title: "Clinical evaluation of autoantibody panel for autoimmune hepatitis diagnosis",
    startDate: "2025-07-01",
    trialId: "NCT-TRIAL-003",
  },
  {
    companyName: "The Binding Site Group",
    domain: "bindingsite.com",
    description: "Specialist protein diagnostics — Freelite assay for multiple myeloma monitoring",
    applicationAreas: ["Plasma Proteins", "Oncology & Tumor Markers"],
    phase: "Phase IV",
    title: "Post-market clinical follow-up of Freelite serum free light chain assay",
    startDate: "2025-10-01",
    trialId: "NCT-TRIAL-004",
  },
];

export class ClinicalTrialsAdapter implements SourceAdapter {
  readonly id = "clinical-trials";
  readonly name = "ClinicalTrials.gov (Stub)";
  readonly description = "Simulated trial registrations for diagnostics companies";

  async fetch(): Promise<RawLead[]> {
    return TRIALS.map((t, i) => ({
      sourceId: `ct-${i + 1}`,
      sourceUrl: `https://clinicaltrials.gov/ct2/show/${t.trialId}`,
      raw: t as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const t = raw.raw as unknown as TrialRecord;
    const signals: Signal[] = [
      {
        type: "CLINICAL_TRIAL",
        date: t.startDate,
        confidence: 0.7,
        description: `${t.phase} trial: ${t.title}`,
        url: raw.sourceUrl,
      },
    ];
    return {
      sourceId: raw.sourceId,
      companyName: t.companyName,
      domain: t.domain,
      description: t.description,
      applicationAreas: t.applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
