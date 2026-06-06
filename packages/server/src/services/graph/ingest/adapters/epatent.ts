import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const EPO_AUTH_URL = "https://ops.epo.org/3.2/auth/accesstoken";
const EPO_API_BASE = "https://ops.epo.org/3.2/rest-services";

/** IPC codes relevant to in-vitro diagnostics */
const IPC_CODES = [
  "G01N33/53",   // Immunoassay
  "G01N33/543",  // Immunoassay with carrier
  "G01N33/569",  // Microorganism
  "G01N33/574",  // Cancer
  "G01N33/68",   // Proteins
  "G01N33/86",   // Coagulation
];

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

interface EPOAuthResponse {
  access_token: string;
  expires_in: number;
}

interface EPOSearchResult {
  "ops:world-patent-data"?: {
    "ops:bibliographic-data"?: {
      "exchange-documents"?: {
        "exchange-document"?: Array<{
          "bibliographic-data": {
            "publication-reference": {
              "document-id": Array<{
                "doc-number": string;
                "country": string;
                "kind"?: string;
                "date"?: string;
              }>;
            };
            "application-reference"?: {
              "document-id": Array<{
                "doc-number": string;
                "country": string;
              }>;
            };
            "invention-title"?: Array<{ $: string; lang?: string }> | { $: string; lang?: string };
            "abstract"?: {
              "p"?: Array<{ $: string }>;
            };
            "applicants"?: {
              "applicant"?: Array<{
                "applicant-name"?: {
                  "name"?: { $: string };
                };
              }>;
            };
            "classifications-ipcr"?: {
              "classification-ipcr"?: Array<{
                "text"?: string;
              }>;
            };
          };
        }>;
      };
    };
  };
  "ops:query-result"?: {
    "ops:total-result-count": number;
  };
}

interface EPOPatent {
  docNumber: string;
  country: string;
  kind?: string;
  pubDate?: string;
  title: string;
  abstract?: string;
  applicantName: string;
  ipcCodes: string[];
  filingDate?: string;
}

/** Extract patent records from the EPO XML-style JSON response */
function parseSearchResponse(data: EPOSearchResult): EPOPatent[] {
  const patents: EPOPatent[] = [];
  const docs =
    data["ops:world-patent-data"]?.["ops:bibliographic-data"]?.["exchange-documents"]?.["exchange-document"];
  if (!docs) return patents;

  for (const doc of docs) {
    const biblio = doc["bibliographic-data"];
    if (!biblio) continue;

    const pubRef = biblio["publication-reference"]?.["document-id"]?.find((d) => d["doc-number"]);
    if (!pubRef) continue;

    // Parse title (can be array or single object)
    const titles = biblio["invention-title"];
    const title = Array.isArray(titles)
      ? (titles[0]?.$ ?? "")
      : (titles?.$ ?? "");

    // Parse abstract
    const abstractP = biblio["abstract"]?.p;
    const abstractStr = Array.isArray(abstractP) ? abstractP.map((p) => p.$).join(" ") : "";

    // Parse applicant
    const applicant = biblio["applicants"]?.applicant?.[0];
    const applicantName = applicant?.["applicant-name"]?.name?.$ ?? "";

    // Parse IPC codes
    const ipcr = biblio["classifications-ipcr"]?.["classification-ipcr"];
    const ipcCodes = ipcr ? ipcr.map((c) => c.text ?? "").filter(Boolean) : [];

    // Parse filing date
    const filingDocs = biblio["application-reference"]?.["document-id"] ?? [];
    const filingDocDate = filingDocs.find((d: Record<string, unknown>) => d["doc-number"] && typeof d === "object" && "date" in d) as { date?: string } | undefined;
    const filingDate = filingDocDate?.date;

    patents.push({
      docNumber: pubRef["doc-number"],
      country: pubRef.country ?? "DE",
      kind: pubRef.kind,
      pubDate: pubRef.date,
      title,
      abstract: abstractStr,
      applicantName,
      ipcCodes,
      filingDate,
    });
  }

  return patents;
}

/** Build CQL query for DE patents in the IVD IPC space */
function buildCqlQuery(): string {
  const ipcClauses = IPC_CODES.map((code) => `ic=${code}`);
  return `(pa=DE OR pa=DDR) AND (${ipcClauses.join(" OR ")})`;
}

function extractApplicationAreas(title: string, ipcCodes: string[], abstract: string): string[] {
  const combined = `${title} ${abstract} ${ipcCodes.join(" ")}`.toLowerCase();
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

  if (areas.length === 0) areas.push("Infectious Disease & Serology");
  return areas;
}

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export class EPatentAdapter implements SourceAdapter {
  readonly id = "epatent";
  readonly name = "EPO DE Patents (IVD)";
  readonly description = "European Patent Office — German patents in in-vitro diagnostics IPC classes";

  private accessToken: string | null = null;
  private tokenExpiry = 0;

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const key = getEnvOrThrow("EPO_CONSUMER_KEY");
    const secret = getEnvOrThrow("EPO_CONSUMER_SECRET");

    const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

    const res = await fetch(EPO_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`EPO OAuth failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as EPOAuthResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken!;
  }

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenDocNumbers = new Set<string>();

    const token = await this.getAccessToken();
    const cql = buildCqlQuery();
    const encodedCql = encodeURIComponent(cql);

    for (let page = 0; page < MAX_PAGES; page++) {
      const rangeBegin = page * PAGE_SIZE + 1;
      const rangeEnd = (page + 1) * PAGE_SIZE;

      try {
        const url = `${EPO_API_BASE}/published-data/search?q=${encodedCql}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent": "LeadGraph/1.0",
            Range: `items=${rangeBegin}-${rangeEnd}`,
          },
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
          // 403 = quota exceeded, stop gracefully
          if (res.status === 403 || res.status === 429) break;
          if (res.status === 404) break;
          continue;
        }

        const data = (await res.json()) as EPOSearchResult;
        const patents = parseSearchResponse(data);

        if (!patents.length) break;

        for (const patent of patents) {
          const docKey = `${patent.country}-${patent.docNumber}`;
          if (seenDocNumbers.has(docKey)) continue;
          seenDocNumbers.add(docKey);

          if (!patent.applicantName) continue;

          allLeads.push({
            sourceId: `ep-${docKey}`,
            sourceUrl: `https://worldwide.espacenet.com/patent/search?q=${patent.country}${patent.docNumber}${patent.kind ?? ""}`,
            raw: {
              docNumber: patent.docNumber,
              country: patent.country,
              kind: patent.kind,
              title: patent.title,
              abstract: patent.abstract ?? "",
              applicantName: patent.applicantName,
              ipcCodes: patent.ipcCodes,
              pubDate: patent.pubDate ?? patent.filingDate ?? "",
            } as unknown as Record<string, unknown>,
          });
        }

        // Check if we've hit the last page
        const total = data["ops:query-result"]?.["ops:total-result-count"] ?? 0;
        if (rangeEnd >= total) break;
      } catch (err) {
        console.warn(`[EPatent] Page ${page} error: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.applicantName as string;
    const title = (r.title as string) ?? "";
    const pubDate = (r.pubDate as string) ?? new Date().toISOString().slice(0, 10);
    const ipcCodes = (r.ipcCodes as string[]) ?? [];
    const abstract = (r.abstract as string) ?? "";
    const docNumber = (r.docNumber as string) ?? "";

    const applicationAreas = extractApplicationAreas(title, ipcCodes, abstract);

    const signals: Signal[] = [
      {
        type: "PATENT",
        date: pubDate,
        confidence: 0.7,
        description: `DE Patent ${docNumber}: ${title.slice(0, 200)}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      domain: `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      description: `Patent: ${title.slice(0, 150)}`,
      applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const cql = encodeURIComponent("pa=DE");
      const res = await fetch(`${EPO_API_BASE}/published-data/search?q=${cql}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "LeadGraph/1.0",
          Range: "items=0-1",
        },
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
