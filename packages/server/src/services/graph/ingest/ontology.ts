import { runQuery } from "../neo4j.js";
import { SeedSummary } from "./types.js";
import { normalizeCompanyName } from "./orchestrator.js";

const APPLICATION_AREAS = [
  "Hemostasis & Thrombosis",
  "Plasma Proteins",
  "Infectious Disease & Serology",
  "Cardiac Markers",
  "Oncology & Tumor Markers",
  "Autoimmune Diagnostics",
  "Specialty Proteins & Reagents",
];

const PRODUCTS: Array<{ name: string; category: string; applications: string[] }> = [
  { name: "Thromborel S", category: "HEMOSTASIS", applications: ["Hemostasis & Thrombosis"] },
  { name: "Innovin", category: "HEMOSTASIS", applications: ["Hemostasis & Thrombosis"] },
  { name: "N Antiserum to Human Proteins", category: "PLASMA_PROTEINS", applications: ["Plasma Proteins"] },
  { name: "BNII Calibrator Set", category: "PLASMA_PROTEINS", applications: ["Plasma Proteins"] },
  { name: "Atellica NEPH 630 Reagents", category: "NEPHELOMETRY", applications: ["Plasma Proteins", "Specialty Proteins & Reagents"] },
  { name: "ADVIA Centaur Reagents", category: "IMMUNOASSAY", applications: ["Infectious Disease & Serology", "Cardiac Markers", "Oncology & Tumor Markers"] },
  { name: "IMMULITE Reagents", category: "IMMUNOASSAY", applications: ["Autoimmune Diagnostics"] },
  { name: "Atellica CH Reagents", category: "CLINICAL_CHEMISTRY", applications: ["Specialty Proteins & Reagents"] },
  { name: "Dade Actin FSL", category: "HEMOSTASIS", applications: ["Hemostasis & Thrombosis"] },
  { name: "Hemolance Coagulation Reagents", category: "HEMOSTASIS", applications: ["Hemostasis & Thrombosis"] },
];

const COMPANIES: Array<{
  name: string;
  domain: string;
  description: string;
  segment: string;
  region: string;
  applications: string[];
  signals: Array<{ type: string; date: string; confidence: number; description: string }>;
}> = [
  {
    name: "SERION Immunologics GmbH",
    domain: "serion-immunologics.de",
    description: "German diagnostics company specializing in serological assays for infectious disease and autoimmune diagnostics",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Infectious Disease & Serology", "Autoimmune Diagnostics"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-11-15", confidence: 0.9, description: "FDA 510(k) clearance for SERION ELISA classic HSV-1/2 IgG assays" },
      { type: "CONFERENCE", date: "2025-09-20", confidence: 0.7, description: "Exhibitor at MEDICA 2025 with new assay portfolio" },
    ],
  },
  {
    name: "ASKA Pharmaceutical Co., Ltd.",
    domain: "aska-pharma.co.jp",
    description: "Japanese pharmaceutical with diagnostics division focused on hemostasis and immunology assays",
    segment: "IVD_MANUFACTURER",
    region: "ASIA",
    applications: ["Hemostasis & Thrombosis", "Autoimmune Diagnostics"],
    signals: [
      { type: "PATENT", date: "2025-10-01", confidence: 0.8, description: "EP patent filing for novel coagulation factor VIIa assay method" },
      { type: "HIRING", date: "2025-08-15", confidence: 0.6, description: "Hiring: Senior R&D Scientist for hemostasis assay development" },
    ],
  },
  {
    name: "J. T. Chemical (JTC)",
    domain: "jtchemical.com",
    description: "Specialty chemical manufacturer supplying raw materials and intermediates for diagnostics",
    segment: "SUPPLIER",
    region: "ASIA",
    applications: ["Specialty Proteins & Reagents"],
    signals: [
      { type: "NEWS", date: "2025-12-01", confidence: 0.5, description: "Announced expansion of diagnostic raw material production capacity" },
    ],
  },
  {
    name: "BioGenes GmbH",
    domain: "biogenes.de",
    description: "German biotech specializing in antibody production and immunoassay development for diagnostics",
    segment: "CDMO",
    region: "EUROPE",
    applications: ["Infectious Disease & Serology", "Plasma Proteins"],
    signals: [
      { type: "CLINICAL_TRIAL", date: "2025-09-10", confidence: 0.7, description: "Clinical validation of new anti-SARS-CoV-2 antibody panel" },
      { type: "HIRING", date: "2025-11-20", confidence: 0.6, description: "Hiring: QA Manager and Production Scientist for antibody manufacturing" },
    ],
  },
  {
    name: "Mikrogen GmbH",
    domain: "mikrogen.de",
    description: "German diagnostics company focused on infectious disease serology and recombinant antigens",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Infectious Disease & Serology"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-07-22", confidence: 0.85, description: "FDA 510(k) for recomLine Borrelia IgG/IgM immunoblot assay" },
      { type: "PATENT", date: "2025-05-30", confidence: 0.75, description: "German patent for novel recombinant antigen expression system" },
    ],
  },
  {
    name: "DIARECT AG",
    domain: "diarect.com",
    description: "German biotech developing autoimmune and infectious disease diagnostics with focus on innovative antigens",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Autoimmune Diagnostics", "Infectious Disease & Serology"],
    signals: [
      { type: "CONFERENCE", date: "2025-10-15", confidence: 0.6, description: "Presenting new autoimmune panel at ADLM 2025" },
      { type: "NEWS", date: "2025-06-05", confidence: 0.5, description: "Received IVDR certification for autoimmune assay line" },
    ],
  },
  {
    name: "DRG Instruments GmbH",
    domain: "drg-diagnostics.de",
    description: "German diagnostics manufacturer of ELISA kits for endocrinology, infectious disease, and oncology",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Oncology & Tumor Markers", "Infectious Disease & Serology"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-04-10", confidence: 0.8, description: "FDA 510(k) for DRG PSA and free PSA ELISA assays" },
      { type: "HIRING", date: "2025-10-01", confidence: 0.55, description: "Hiring: International Sales Manager for EMEA diagnostics market" },
    ],
  },
  {
    name: "IBL International GmbH",
    domain: "ibl-international.com",
    description: "German immunodiagnostics company specializing in autoimmune, infectious disease and neuroassay kits",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Autoimmune Diagnostics", "Infectious Disease & Serology"],
    signals: [
      { type: "PATENT", date: "2025-08-20", confidence: 0.7, description: "Patent application for novel neurological autoimmune marker panel" },
      { type: "CONFERENCE", date: "2025-11-05", confidence: 0.6, description: "Exhibitor at MEDICA 2025 with autoimmune portfolio" },
    ],
  },
  {
    name: "Aesku.Diagnostics GmbH",
    domain: "aesku.com",
    description: "German immunodiagnostics company with focus on autoimmune serology and allergen testing",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Autoimmune Diagnostics", "Specialty Proteins & Reagents"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-03-15", confidence: 0.85, description: "FDA clearance for AESKU BLOT autoimmune line" },
      { type: "NEWS", date: "2025-09-01", confidence: 0.5, description: "Launched new HEp-2 substrate for ANA screening" },
    ],
  },
  {
    name: "Euroimmun AG",
    domain: "euroimmun.com",
    description: "German immunodiagnostics leader (PerkinElmer) in autoimmune, infectious disease, and allergy testing",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Autoimmune Diagnostics", "Infectious Disease & Serology", "Cardiac Markers"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-12-10", confidence: 0.9, description: "FDA 510(k) for Euroimmun Anti-dsDNA ELISA" },
      { type: "CLINICAL_TRIAL", date: "2025-11-01", confidence: 0.75, description: "Clinical study for novel autoimmune hepatitis marker panel" },
      { type: "FUNDING", date: "2025-06-01", confidence: 0.8, description: "PerkinElmer investment in Euroimmun expansion for autoimmune portfolio" },
    ],
  },
  {
    name: "Phadia GmbH",
    domain: "phadia.com",
    description: "ThermoFisher subsidiary specializing in in vitro allergy and autoimmune diagnostics",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Autoimmune Diagnostics", "Specialty Proteins & Reagents"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-10-05", confidence: 0.85, description: "FDA 510(k) for ImmunoCAP allergy panel expansion" },
      { type: "HIRING", date: "2025-11-15", confidence: 0.6, description: "Hiring: R&D Director for autoimmune assay development" },
    ],
  },
  {
    name: "Hycor Biomedical",
    domain: "hycorbiomedical.com",
    description: "US-based autoimmune diagnostics company with focus on allergy and autoimmune ELISA systems",
    segment: "IVD_MANUFACTURER",
    region: "NORTH_AMERICA",
    applications: ["Autoimmune Diagnostics", "Specialty Proteins & Reagents"],
    signals: [
      { type: "PATENT", date: "2025-07-01", confidence: 0.65, description: "US patent for novel autoimmune diagnostic panel technology" },
      { type: "NEWS", date: "2025-04-15", confidence: 0.5, description: "Announced new distribution partnership for European market" },
    ],
  },
  {
    name: "The Binding Site Group",
    domain: "bindingsite.com",
    description: "UK-based diagnostics company specializing in plasma protein and immunology assays for serum protein analysis",
    segment: "IVD_MANUFACTURER",
    region: "EUROPE",
    applications: ["Plasma Proteins", "Oncology & Tumor Markers"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-09-28", confidence: 0.9, description: "FDA 510(k) for Freelite serum free light chain assay" },
      { type: "CLINICAL_TRIAL", date: "2025-08-01", confidence: 0.7, description: "Clinical study of novel heavy/light chain assay for multiple myeloma monitoring" },
    ],
  },
  {
    name: "Kamiya Biomedical Company",
    domain: "kamiyabiomedical.com",
    description: "US supplier of research and diagnostic antibodies, proteins, and ELISA kits for biomedical research",
    segment: "SUPPLIER",
    region: "NORTH_AMERICA",
    applications: ["Specialty Proteins & Reagents", "Plasma Proteins"],
    signals: [
      { type: "NEWS", date: "2025-05-20", confidence: 0.5, description: "Expanded catalog of diagnostic-grade monoclonal antibodies" },
    ],
  },
  {
    name: "Bio-Rad Laboratories",
    domain: "bio-rad.com",
    description: "Global life science and clinical diagnostics company with extensive immunoassay and quality control portfolio",
    segment: "IVD_MANUFACTURER",
    region: "NORTH_AMERICA",
    applications: ["Infectious Disease & Serology", "Cardiac Markers", "Oncology & Tumor Markers", "Plasma Proteins"],
    signals: [
      { type: "FDA_CLEARANCE", date: "2025-11-20", confidence: 0.9, description: "FDA 510(k) for Bio-Rad BioPlex 2200 syphilis assay" },
      { type: "FUNDING", date: "2025-06-15", confidence: 0.8, description: "Bio-Rad announces $50M investment in clinical diagnostics R&D" },
      { type: "HIRING", date: "2025-12-01", confidence: 0.6, description: "Hiring: Senior Scientist for immunoassay development in diagnostics division" },
    ],
  },
];

export async function seedGraph(): Promise<SeedSummary> {
  // Create constraints (idempotent — IF NOT EXISTS)
  await runQuery("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Company) REQUIRE c.normalizedName IS UNIQUE");
  await runQuery("CREATE CONSTRAINT IF NOT EXISTS FOR (a:Application) REQUIRE a.name IS UNIQUE");
  await runQuery("CREATE INDEX IF NOT EXISTS FOR (s:Signal) ON (s.type)");

  // Batch 1: Siemens + all applications
  await runQuery(
    `MERGE (c:Company {normalizedName: $normName})
     SET c.name = $name, c.domain = $domain, c.description = $description, c.segment = $segment, c.region = $region`,
    { normName: normalizeCompanyName("Siemens Healthineers"), name: "Siemens Healthineers", domain: "siemens-healthineers.com", description: "Global medical technology company — Marburg site produces biological intermediates for diagnostics", segment: "IVD_MANUFACTURER", region: "EUROPE" }
  );

  await runQuery(
    `UNWIND $apps AS app
     MERGE (a:Application {name: app.name})
     SET a.category = app.category`,
    { apps: APPLICATION_AREAS.map((name) => ({ name, category: "DIAGNOSTICS" })) }
  );

  // Batch 2: All products + links to Siemens
  const productRows = PRODUCTS.map((p) => ({
    catalogId: `SH-${p.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`,
    name: p.name,
    category: p.category,
  }));
  await runQuery(
    `UNWIND $products AS p
     MERGE (prod:Product {catalogId: p.catalogId})
     SET prod.name = p.name, prod.category = p.category
     WITH prod, p
     MATCH (c:Company {normalizedName: $normName})
     MERGE (c)-[:SUPPLIES]->(prod)`,
    { products: productRows, normName: normalizeCompanyName("Siemens Healthineers") }
  );

  // Batch 3: All product→application links
  const productAppRows: Array<{ catalogId: string; app: string }> = [];
  for (const p of PRODUCTS) {
    const catalogId = `SH-${p.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
    for (const app of p.applications) {
      productAppRows.push({ catalogId, app });
    }
  }
  await runQuery(
    `UNWIND $links AS l
     MATCH (p:Product {catalogId: l.catalogId}), (a:Application {name: l.app})
     MERGE (p)-[:USED_IN]->(a)`,
    { links: productAppRows }
  );

  // Batch 4: All companies
  const companyRows = COMPANIES.map((c) => ({
    normName: normalizeCompanyName(c.name),
    name: c.name,
    domain: c.domain,
    description: c.description,
    segment: c.segment,
    region: c.region,
  }));
  await runQuery(
    `UNWIND $companies AS c
     MERGE (comp:Company {normalizedName: c.normName})
     SET comp.name = c.name, comp.domain = c.domain,
         comp.description = c.description, comp.segment = c.segment,
         comp.region = c.region`,
    { companies: companyRows }
  );

  // Batch 5: All company→application links
  const companyAppRows: Array<{ normName: string; app: string }> = [];
  for (const c of COMPANIES) {
    const normName = normalizeCompanyName(c.name);
    for (const app of c.applications) {
      companyAppRows.push({ normName, app });
    }
  }
  await runQuery(
    `UNWIND $links AS l
     MATCH (c:Company {normalizedName: l.normName}), (a:Application {name: l.app})
     MERGE (c)-[:DEVELOPS]->(a)`,
    { links: companyAppRows }
  );

  // Batch 6: All signals
  const signalRows: Array<{ normName: string; type: string; date: string; confidence: number; description: string }> = [];
  for (const c of COMPANIES) {
    const normName = normalizeCompanyName(c.name);
    for (const s of c.signals) {
      signalRows.push({ normName, ...s });
    }
  }
  await runQuery(
    `UNWIND $signals AS sig
     MATCH (c:Company {normalizedName: sig.normName})
     CREATE (s:Signal {
       type: sig.type, date: sig.date, confidence: sig.confidence,
       description: sig.description, url: null
     })
     MERGE (c)-[:HAS_SIGNAL]->(s)`,
    { signals: signalRows }
  );

  return {
    constraintsCreated: 3,
    applicationAreas: APPLICATION_AREAS.length,
    companiesSeeded: 1 + COMPANIES.length,
    productsSeeded: PRODUCTS.length,
    relationshipsCreated:
      1 + // Siemens→products (batched)
      productAppRows.length +
      companyAppRows.length +
      signalRows.length,
  };
}
