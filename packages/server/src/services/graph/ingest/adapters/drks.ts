import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const DRKS_BULK_URL = "https://drks.de/search/en/download/all-json";

/** Diagnostic-relevant condition keywords to filter DRKS studies */
const CONDITION_FILTERS = [
  // Infectious disease
  /infectious|serolog|hepatitis|hiv|covid|tb|tuberculosis|malaria|dengue|zika|ebola|influenza|respiratory|sars|meningitis|sepsis|syphilis|chlamydia|gonorrhea|hpv|pathogen|virus|bacterial|microbiology/i,
  // Autoimmune
  /autoimmune|rheumat|lupus|celiac|ibd|crohn|colitis|sjogren|scleroderma|vasculitis|myasthenia|guillain|autoantibody/i,
  // Oncology
  /tumor|cancer|oncology|neoplasm|malignancy|carcinoma|sarcoma|leukemia|lymphoma|myeloma|biomarker|circulating/i,
  // Cardiac
  /cardiac|heart|cardiovascular|troponin|bnp|nt-probnp|ck-mb|myoglobin|coronary|myocardial|infarction|heart failure|arrhythmia/i,
  // Coagulation
  /coagulation|hemostasis|thrombosis|clotting|d-dimer|fibrinogen|pt|inr|aptt|anticoagulant|hemophilia|von willebrand/i,
  // Allergy
  /allergy|allergen|ige|anaphylaxis|hypersensitivity|atopic|asthma|rhinitis/i,
  // Endocrinology
  /endocrin|thyroid|tsh|t3|t4|cortisol|insulin|glucose|hba1c|diabetes|hcg|prolactin|fsh|lh|testosterone|estrogen|progesterone/i,
  // Transplant
  /transplant|hla|immunosuppress|rejection|graft|donor|recipient/i,
  // Diagnostic method keywords
  /immunoassay|elisa|lateral.flow|rapid.test|point.of.care|chemiluminescence|immunofluorescence|diagnostic|assay|antigen|antibody|serolog/i,
];

/** Primary sponsor shape in DRKS JSON */
interface DRKSSponsor {
  name?: string;
  type?: string;
}

/** A single study from the DRKS bulk JSON array */
interface DRKSStudy {
  drksId?: string;
  title?: string;
  scientificTitle?: string;
  studyType?: string;
  recruitmentStatus?: string;
  registrationDate?: string;
  startDate?: string;
  primarySponsor?: DRKSSponsor | string;
  sponsor?: DRKSSponsor | string;
  conditions?: string[];
  healthConditions?: string[];
  countries?: string[];
  url?: string;
  briefSummary?: string;
  scientificSummary?: string;
}

/** Fields searched by DRKS search tool: title, summary, drksId */
function studyMatchesConditions(study: DRKSStudy): boolean {
  const searchText = [
    study.title,
    study.scientificTitle,
    study.briefSummary,
    study.scientificSummary,
    ...(study.conditions ?? []),
    ...(study.healthConditions ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return CONDITION_FILTERS.some((re) => re.test(searchText));
}

function extractSponsorName(study: DRKSStudy): string | null {
  const sponsor = study.primarySponsor ?? study.sponsor;
  if (!sponsor) return null;
  if (typeof sponsor === "string") return sponsor.trim();
  return sponsor.name?.trim() ?? null;
}

/** Map conditions/study text to application areas — mirrors clinical-trials.ts */
function extractApplicationAreas(study: DRKSStudy): string[] {
  const combined = [
    study.title,
    study.scientificTitle,
    study.briefSummary,
    study.scientificSummary,
    ...(study.conditions ?? []),
    ...(study.healthConditions ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const areas: string[] = [];

  if (/infectious|serolog|hepatitis|hiv|covid|tb|tuberculosis|malaria|dengue|zika|ebola|influenza|respiratory|sars|meningitis|sepsis|syphilis|chlamydia|gonorrhea|hpv/.test(combined))
    areas.push("Infectious Disease & Serology");
  if (/autoimmune|rheumat|lupus|celiac|ibd|crohn|colitis|sjogren|scleroderma|vasculitis|myasthenia|guillain/.test(combined))
    areas.push("Autoimmune Diagnostics");
  if (/tumor|cancer|oncology|neoplasm|malignancy|carcinoma|sarcoma|leukemia|lymphoma|myeloma|biomarker/.test(combined))
    areas.push("Oncology & Tumor Markers");
  if (/cardiac|heart|cardiovascular|troponin|bnp|nt-probnp|ck-mb|myoglobin|coronary|myocardial|infarction|heart failure|arrhythmia/.test(combined))
    areas.push("Cardiac Markers");
  if (/coagulation|hemostasis|thrombosis|clotting|d-dimer|fibrinogen|pt|inr|aptt|anticoagulant|hemophilia|von willebrand/.test(combined))
    areas.push("Hemostasis & Thrombosis");
  if (/allergy|allergen|ige|anaphylaxis|hypersensitivity|atopic|asthma|rhinitis/.test(combined))
    areas.push("Allergy Diagnostics");
  if (/endocrin|thyroid|tsh|t3|t4|cortisol|insulin|glucose|hba1c|diabetes|hcg|prolactin|fsh|lh|testosterone|estrogen|progesterone/.test(combined))
    areas.push("Endocrinology");
  if (/transplant|hla|immunosuppress|rejection|graft|donor|recipient/.test(combined))
    areas.push("Transplant Diagnostics");

  if (areas.length === 0) areas.push("Infectious Disease & Serology");
  return areas;
}

export class DRKSAdapter implements SourceAdapter {
  readonly id = "drks";
  readonly name = "DRKS (German Clinical Trials Register)";
  readonly description = "German Clinical Trials Register — diagnostic-related studies from German sponsors";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenDrksIds = new Set<string>();

    let studies: DRKSStudy[] = [];

    try {
      const res = await fetch(DRKS_BULK_URL, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        console.warn(`[DRKS] Bulk download failed: ${res.status} ${res.statusText}`);
        return allLeads;
      }

      // The bulk endpoint returns a JSON array of studies
      const data = (await res.json()) as DRKSStudy[] | { studies?: DRKSStudy[] };
      studies = Array.isArray(data) ? data : (data.studies ?? []);
    } catch (err) {
      console.warn(`[DRKS] Bulk download error: ${err instanceof Error ? err.message : String(err)}`);
      return allLeads;
    }

    for (const study of studies) {
      const drksId = study.drksId;
      if (!drksId || seenDrksIds.has(drksId)) continue;
      seenDrksIds.add(drksId);

      // Filter: must match diagnostic conditions
      if (!studyMatchesConditions(study)) continue;

      const companyName = extractSponsorName(study);
      if (!companyName) continue;

      allLeads.push({
        sourceId: `drks-${drksId}`,
        sourceUrl: study.url ?? `https://drks.de/search/en/trial/${drksId}`,
        raw: {
          drksId,
          companyName,
          title: study.title ?? study.scientificTitle ?? "",
          conditions: study.conditions ?? study.healthConditions ?? [],
          registrationDate: study.registrationDate ?? "",
          startDate: study.startDate ?? "",
          recruitmentStatus: study.recruitmentStatus ?? "",
          studyType: study.studyType ?? "",
          briefSummary: study.briefSummary ?? "",
        } as unknown as Record<string, unknown>,
      });
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const title = (r.title as string) ?? "";
    const drksId = (r.drksId as string) ?? "";
    const startDate = (r.startDate as string) ?? "";
    const registrationDate = (r.registrationDate as string) ?? "";

    const date = startDate || registrationDate || new Date().toISOString().slice(0, 10);

    const conditions = (r.conditions as string[]) ?? [];
    const studyLike: DRKSStudy = { title, conditions };
    const applicationAreas = extractApplicationAreas(studyLike);

    const signals: Signal[] = [
      {
        type: "CLINICAL_TRIAL",
        date,
        confidence: 0.65,
        description: `DRKS ${drksId}: ${title.slice(0, 200)}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      domain: `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      description: `Clinical trial (DRKS): ${title.slice(0, 150)}`,
      applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    // We can't easily HEAD 18MB, so try fetching just the first few bytes
    try {
      const res = await fetch(DRKS_BULK_URL, {
        method: "GET",
        headers: {
          "User-Agent": "LeadGraph/1.0",
          Accept: "application/json",
          Range: "bytes=0-1024",
        },
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok || res.status === 206;
    } catch {
      return false;
    }
  }
}
