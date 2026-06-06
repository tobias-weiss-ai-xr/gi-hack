import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const MEDICA_SEARCH_URL = "https://www.medica-tradefair.com/vis/v1/en/search";

const MAX_PAGES = 20;
const PAGE_SIZE = 30;

/** Filter to only diagnostic-relevant DACH-market exhibitors */
const DIAGNOSTIC_COUNTRY_CODES = new Set(["DE", "AT", "CH"]);

/** Product category keywords that indicate diagnostic relevance */
const DIAGNOSTIC_CATEGORY_KEYWORDS = [
  /diagnosti?c/i,
  /immunoassay|elisa|serolog/i,
  /labor|lab.?test|lab.?diagnos/i,
  /in.?vitro|ivd/i,
  /assay|reagent|antibody|antigen/i,
  /clinical.?chem/i,
  /point.?of.?care|lateral.?flow|rapid.?test/i,
  /hematolog|coagulation|hemostas/i,
  /microbiology|pathogen|infectious/i,
];

interface MedicaExhibitor {
  profileUrl: string;
  companyName: string;
  website?: string;
  email?: string;
  phone?: string;
  hallStands?: string;
  country?: string;
  address?: string;
  description?: string;
  productCategories: string[];
}

/** Parse a single row/result from the MEDICA listing page */
function extractExhibitorsFromHtml(html: string): MedicaExhibitor[] {
  const exhibitors: MedicaExhibitor[] = [];

  // Match exhibitor result blocks — look for profile links and company info
  const profileLinkRegex = /href="(\/vis\/v1\/en\/exhprofiles\/[^"]+)"/g;
  const foundUrls = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = profileLinkRegex.exec(html)) !== null) {
    foundUrls.add(match[1]);
  }

  // Extract data-* attributes or structured JSON embedded in the page
  // The /vis/v1/ platform embeds data in a structured format
  const scriptRegex = /window\.__INITIAL_STATE__\s*=\s*({.+?});/s;
  const scriptMatch = html.match(scriptRegex);

  if (scriptMatch) {
    try {
      const state = JSON.parse(scriptMatch[1]);
      // Try common paths for exhibitor data in /vis/v1/ state
      const items = state?.search?.results ?? state?.results ?? state?.items ?? [];
      for (const item of items) {
        const companyName = item.name ?? item.companyName ?? item.title ?? "";
        if (!companyName) continue;

        exhibitors.push({
          profileUrl: item.url ?? item.profileUrl ?? item.link ?? "",
          companyName,
          website: item.website ?? item.homepage ?? "",
          email: item.email ?? "",
          phone: item.phone ?? "",
          hallStands: item.hall ?? item.stand ?? item.hallStands ?? "",
          country: item.country ?? item.addressCountry ?? "",
          address: item.address ?? "",
          description: item.description ?? item.about ?? "",
          productCategories: item.categories ?? item.productCategories ?? item.tags ?? [],
        });
      }
      return exhibitors;
    } catch {
      // JSON parse failed, fall through to HTML parsing
    }
  }

  // Fallback: parse exhibitor blocks from the HTML table structure
  // The /vis/v1/ search shows results as structured list items
  const itemBlocks = html.match(/<div[^>]*class="[^"]*result-item[^"]*"[^>]*>.*?<\/div>\s*<\/div>\s*<\/div>/gs);
  if (itemBlocks) {
    for (const block of itemBlocks) {
      const nameMatch = block.match(/<h[23][^>]*>(.*?)<\/h[23]>/);
      const companyName = nameMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
      if (!companyName) continue;

      const countryMatch = block.match(/country[:\s]+([A-Z]{2})/i);
      const country = countryMatch?.[1] ?? "";
      const descMatch = block.match(/<p[^>]*class="[^"]*desc[^"]*"[^>]*>(.*?)<\/p>/s);
      const description = descMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
      const linkMatch = block.match(/href="(\/vis\/v1\/en\/exhprofiles\/[^"]+)"/);
      const profileUrl = linkMatch?.[1] ?? "";
      const websiteMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(?:website|homepage|www)/i);
      const website = websiteMatch?.[1] ?? "";

      // Extract categories from the block
      const categoryMatches = block.match(/<span[^>]*class="[^"]*category[^"]*"[^>]*>(.*?)<\/span>/g);
      const productCategories: string[] = [];
      if (categoryMatches) {
        for (const cm of categoryMatches) {
          const cat = cm.replace(/<[^>]+>/g, "").trim();
          if (cat) productCategories.push(cat);
        }
      }

      exhibitors.push({ profileUrl, companyName, website, country, description, productCategories });
    }
  }

  return exhibitors;
}

function isDiagnosticRelevant(exhibitor: MedicaExhibitor): boolean {
  const searchText = [
    exhibitor.companyName,
    exhibitor.description,
    ...exhibitor.productCategories,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return DIAGNOSTIC_CATEGORY_KEYWORDS.some((re) => re.test(searchText));
}

function extractApplicationAreas(exhibitor: MedicaExhibitor): string[] {
  const combined = [
    exhibitor.companyName,
    exhibitor.description,
    ...exhibitor.productCategories,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const areas: string[] = [];

  if (/infectious|serolog|hepatitis|hiv|covid|microbiology|pathogen|virus|bacterial/.test(combined))
    areas.push("Infectious Disease & Serology");
  if (/autoimmune|rheumat|lupus|celiac|ibd/.test(combined))
    areas.push("Autoimmune Diagnostics");
  if (/tumor|cancer|oncology|neoplasm|biomarker/.test(combined))
    areas.push("Oncology & Tumor Markers");
  if (/cardiac|heart|cardiovascular|troponin/.test(combined))
    areas.push("Cardiac Markers");
  if (/coagulation|hemostasis|thrombosis|clotting|d-dimer/.test(combined))
    areas.push("Hemostasis & Thrombosis");
  if (/allergy|allergen|ige/.test(combined))
    areas.push("Allergy Diagnostics");
  if (/endocrin|thyroid|tsh|t3|t4|cortisol|insulin|glucose|hba1c|diabetes/.test(combined))
    areas.push("Endocrinology");
  if (/transplant|hla|immunosuppress/.test(combined))
    areas.push("Transplant Diagnostics");
  if (/point.of.care|lateral.flow|rapid.test|poct/.test(combined))
    areas.push("Point of Care");
  if (/labor|lab.?test|clinical.?chem|hematolog/.test(combined))
    areas.push("Specialty Proteins & Reagents");

  if (areas.length === 0) areas.push("Infectious Disease & Serology");
  return areas;
}

export class MedicaAdapter implements SourceAdapter {
  readonly id = "medica";
  readonly name = "MEDICA Exhibitors";
  readonly description = "MEDICA trade fair exhibitor database — DACH diagnostic companies at the world's largest medtech fair";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenCompanyNames = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const start = page * PAGE_SIZE;

      try {
        const url = `${MEDICA_SEARCH_URL}?ticket=g_u_e_s_t&_query=&f_type=profile&_start=${start}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "LeadGraph/1.0" },
          signal: AbortSignal.timeout(20_000),
        });

        if (!res.ok) {
          if (res.status === 404) break;
          continue;
        }

        const html = await res.text();

        // If the result page is empty or shows "no results", stop
        if (html.includes("no-results") || html.includes("no results") || html.includes("Keine Ergebnisse")) break;

        const exhibitors = extractExhibitorsFromHtml(html);

        if (!exhibitors.length) break;

        for (const ex of exhibitors) {
          const normName = ex.companyName.toLowerCase().trim();
          if (!normName || seenCompanyNames.has(normName)) continue;
          seenCompanyNames.add(normName);

          // Filter to DACH countries + diagnostic relevance
          if (ex.country && !DIAGNOSTIC_COUNTRY_CODES.has(ex.country.toUpperCase())) continue;
          if (!isDiagnosticRelevant(ex)) continue;

          allLeads.push({
            sourceId: `medica-${Buffer.from(normName).toString("base64url").slice(0, 24)}`,
            sourceUrl: ex.profileUrl
              ? `https://www.medica-tradefair.com${ex.profileUrl}`
              : undefined,
            raw: {
              companyName: ex.companyName,
              website: ex.website ?? "",
              email: ex.email ?? "",
              phone: ex.phone ?? "",
              hallStands: ex.hallStands ?? "",
              country: ex.country ?? "",
              address: ex.address ?? "",
              description: ex.description ?? "",
              productCategories: ex.productCategories,
            } as unknown as Record<string, unknown>,
          });
        }
      } catch {
        // Network error — continue to next page
        continue;
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const description = (r.description as string) ?? "";
    const website = (r.website as string) ?? "";
    const productCategories = (r.productCategories as string[]) ?? [];
    const country = (r.country as string) ?? "";

    const exLike: MedicaExhibitor = {
      profileUrl: "",
      companyName,
      description,
      productCategories,
    };
    const applicationAreas = extractApplicationAreas(exLike);

    const signals: Signal[] = [
      {
        type: "CONFERENCE",
        date: new Date().toISOString().slice(0, 10),
        confidence: 0.5,
        description: `MEDICA exhibitor${country ? ` (${country})` : ""}: ${companyName}${productCategories.length ? ` — ${productCategories.slice(0, 3).join(", ")}` : ""}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      domain: website
        ? website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      description: description ? `MEDICA exhibitor: ${description.slice(0, 200)}` : `MEDICA exhibitor`,
      applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${MEDICA_SEARCH_URL}?ticket=g_u_e_s_t&_query=&f_type=profile`, {
        headers: { "User-Agent": "LeadGraph/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
