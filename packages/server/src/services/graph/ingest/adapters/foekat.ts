import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const FOEKAT_SEARCH_URL = "https://foerderportal.bund.de/foekat/jsp/SucheAction.do";
const FOEKAT_CSV_URL = "https://foerderportal.bund.de/foekat/jsp/ExportAction.do";

/** Diagnostic/biotech keywords to filter FÖKAT funding projects */
const FUNDING_KEYWORDS = [
  "diagnostik", "diagnostic", "ivd", "in-vitro", "immunoassay",
  "elisa", "serologie", "serology", "biomarker", "antikörper", "antibody",
  "antigen", "lateral flow", "point-of-care", "schnelltest", "rapid test",
  "labor", "hämostase", "coagulation", "gerinnung",
  "infektions", "infektio", "mikrobiologie", "microbiology",
  "krebs", "tumor", "cancer", "onkologie",
  "autoimmun", "allergie", "allergy",
  "molekulare diagnos", "molecular diagnos",
  "biosensor", "chip", "lab-on-a-chip", "microfluidics", "mikrofluidik",
  "proteom", "genom", "genet", "nukleinsäure", "nucleic acid",
  "durchflusszytometrie", "flow cytometry",
  "bildgebung", "imaging", "optische",
];

/** Keyword-based diagnostic project filter */
function isDiagnosticRelevant(title: string, abstract: string): boolean {
  const combined = `${title} ${abstract}`.toLowerCase();
  return FUNDING_KEYWORDS.some((kw) => combined.includes(kw.toLowerCase()));
}

interface FoekatProject {
  title: string;
  organization: string;
  fundingAmount: string;
  durationStart: string;
  durationEnd: string;
  abstract: string;
  fkz: string;
  ministry: string;
}

function extractApplicationAreas(title: string, abstract: string): string[] {
  const combined = `${title} ${abstract}`.toLowerCase();
  const areas: string[] = [];

  if (/infektions?|serolog|hepatitis|hiv|covid|mikrobiologie|pathogen|virus|bakteri|sepsis|syphilis|hpv/i.test(combined))
    areas.push("Infectious Disease & Serology");
  if (/autoimmun|rheumat|lupus|celiac|ibd|crohn|colitis|sjogren/i.test(combined))
    areas.push("Autoimmune Diagnostics");
  if (/tumor|cancer|oncology|neoplasm|krebs|malignom|karzinom|leukämie/i.test(combined))
    areas.push("Oncology & Tumor Markers");
  if (/cardiac|heart|cardiovascular|troponin|herz|kardiovaskulär/i.test(combined))
    areas.push("Cardiac Markers");
  if (/coagulation|hemostasis|thrombosis|gerinnung|hämostase|blutstillung/i.test(combined))
    areas.push("Hemostasis & Thrombosis");
  if (/allergie|allergen|ige|anaphylaxie/i.test(combined))
    areas.push("Allergy Diagnostics");
  if (/endokrin|thyroid|schilddrüse|insulin|glucose|diabetes|diabete/i.test(combined))
    areas.push("Endocrinology");
  if (/transplant|hla|immunsuppress|abstoßung|graft/i.test(combined))
    areas.push("Transplant Diagnostics");
  if (/point.of.care|lateral.flow|rapid.test|schnelltest|poct/i.test(combined))
    areas.push("Point of Care");

  if (areas.length === 0) areas.push("Infectious Disease & Serology");
  return areas;
}

/** Simple CSV line parser (handles quoted fields) */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.replace(/^"|"$/g, "").trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.replace(/^"|"$/g, "").trim());
  return fields;
}

/** Parse FÖKAT CSV content */
function parseCsv(content: string): FoekatProject[] {
  const projects: FoekatProject[] = [];
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) return projects;

  // Parse header to find column indices
  const header = parseCsvLine(lines[0]);
  const colMap = new Map<string, number>();
  header.forEach((h, i) => colMap.set(h.toLowerCase().trim(), i));

  // Expected column names (German) — FÖKAT CSV uses these
  const titleCol = colMap.get("vorhaben") ?? colMap.get("titel") ?? colMap.get("title") ?? -1;
  const orgCol = colMap.get("foerdernehmer") ?? colMap.get("organisation") ?? colMap.get("zuwendungsempfänger") ?? -1;
  const amountCol = colMap.get("bewilligte summe") ?? colMap.get("foerdersumme") ?? colMap.get("betrag") ?? -1;
  const startCol = colMap.get("laufzeit von") ?? colMap.get("beginn") ?? colMap.get("start") ?? -1;
  const endCol = colMap.get("laufzeit bis") ?? colMap.get("ende") ?? colMap.get("end") ?? -1;
  const abstractCol = colMap.get("kurzbeschreibung") ?? colMap.get("abstract") ?? colMap.get("beschreibung") ?? -1;
  const fkzCol = colMap.get("fkz") ?? colMap.get("foerderkennzeichen") ?? colMap.get("nummer") ?? -1;
  const ministryCol = colMap.get("ressort") ?? colMap.get("ministerium") ?? colMap.get("ministry") ?? -1;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 2) continue;

    const title = titleCol >= 0 && titleCol < fields.length ? fields[titleCol] : "";
    const organization = orgCol >= 0 && orgCol < fields.length ? fields[orgCol] : "";

    if (!title || !organization) continue;

    projects.push({
      title,
      organization,
      fundingAmount: amountCol >= 0 && amountCol < fields.length ? fields[amountCol] : "",
      durationStart: startCol >= 0 && startCol < fields.length ? fields[startCol] : "",
      durationEnd: endCol >= 0 && endCol < fields.length ? fields[endCol] : "",
      abstract: abstractCol >= 0 && abstractCol < fields.length ? fields[abstractCol] : "",
      fkz: fkzCol >= 0 && fkzCol < fields.length ? fields[fkzCol] : "",
      ministry: ministryCol >= 0 && ministryCol < fields.length ? fields[ministryCol] : "",
    });
  }

  return projects;
}

export class FoekatAdapter implements SourceAdapter {
  readonly id = "foekat";
  readonly name = "BMBF FÖKAT";
  readonly description = "German Federal Funding Catalog — public R&D funding projects in diagnostics and life sciences";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenFkz = new Set<string>();
    let allCsvContent = "";

    // Strategy: attempt CSV export download first
    try {
      // Step 1: Trigger a simple search to get all diagnostic-relevant projects
      const searchRes = await fetch(`${FOEKAT_SEARCH_URL}?actionMode=searchmask`, {
        headers: { "User-Agent": "LeadGraph/1.0" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!searchRes.ok) return allLeads;

      // Step 2: Submit search and get export
      const searchParams = new URLSearchParams();
      searchParams.set("actionMode", "search");
      // Search with diagnostic keywords across title and description
      searchParams.set("suchbegriff", "Diagnostik");
      searchParams.set("suchbereich", "alle");
      searchParams.set("sortierung", "relevanz");

      const searchPostRes = await fetch(FOEKAT_SEARCH_URL, {
        method: "POST",
        headers: {
          "User-Agent": "LeadGraph/1.0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: searchParams.toString(),
        signal: AbortSignal.timeout(20_000),
      });

      if (!searchPostRes.ok) return allLeads;

      // Step 3: Request CSV export
      const exportParams = new URLSearchParams();
      exportParams.set("actionMode", "export");
      exportParams.set("exportFormat", "csv");

      const csvRes = await fetch(FOEKAT_CSV_URL, {
        method: "POST",
        headers: {
          "User-Agent": "LeadGraph/1.0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: exportParams.toString(),
        signal: AbortSignal.timeout(60_000),
      });

      if (csvRes.ok) {
        allCsvContent = await csvRes.text();
      }
    } catch (err) {
      console.warn(`[Foekat] CSV download error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // If CSV export worked, parse it
    if (allCsvContent) {
      const projects = parseCsv(allCsvContent);
      for (const project of projects) {
        if (!isDiagnosticRelevant(project.title, project.abstract)) continue;

        const fkzKey = project.fkz || project.title.slice(0, 40);
        if (seenFkz.has(fkzKey)) continue;
        seenFkz.add(fkzKey);

        allLeads.push({
          sourceId: `foekat-${Buffer.from(fkzKey).toString("base64url").slice(0, 24)}`,
          sourceUrl: `https://foerderportal.bund.de/foekat/jsp/SucheAction.do?actionMode=search&fkz=${encodeURIComponent(project.fkz)}`,
          raw: {
            companyName: project.organization,
            title: project.title,
            fundingAmount: project.fundingAmount,
            abstract: project.abstract,
            durationStart: project.durationStart,
            durationEnd: project.durationEnd,
            fkz: project.fkz,
            ministry: project.ministry,
          } as unknown as Record<string, unknown>,
        });
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const title = (r.title as string) ?? "";
    const abstract = (r.abstract as string) ?? "";
    const fundingAmount = (r.fundingAmount as string) ?? "";
    const durationStart = (r.durationStart as string) ?? "";
    const durationEnd = (r.durationEnd as string) ?? "";

    const date = durationStart || new Date().toISOString().slice(0, 10);
    const applicationAreas = extractApplicationAreas(title, abstract);

    const descParts = [`Funding: ${title.slice(0, 120)}`];
    if (fundingAmount) descParts.push(`(${fundingAmount})`);
    if (durationStart && durationEnd) descParts.push(`[${durationStart}–${durationEnd}]`);

    const signals: Signal[] = [
      {
        type: "FUNDING",
        date,
        confidence: 0.6,
        description: descParts.join(" "),
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      domain: `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      description: descParts[0],
      applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(FOEKAT_SEARCH_URL, {
        headers: { "User-Agent": "LeadGraph/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
