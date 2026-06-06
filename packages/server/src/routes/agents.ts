import { Router, Request, Response } from "express";
import neo4j from "neo4j-driver";
import { getContactFinder } from "../services/agents/contactFinder.js";
import { generateOutreachEmail } from "../services/ai/outreach.js";

const router = Router();

const driver = neo4j.driver(
  process.env.NEO4J_URI || "bolt://localhost:7687",
  neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "password"),
);

// ── POST /agents/find-contacts ────────────────────────────────────────────────
// Find contacts for a company by name. Used after qualifier selects HOT/WARM leads.

router.post("/find-contacts", async (req: Request, res: Response): Promise<any> => {
  const { companyName } = req.body;
  if (!companyName || typeof companyName !== "string") {
    return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "companyName is required" } });
  }

  const session = driver.session();
  try {
    // Fetch company data from Neo4j
    const result = await session.run(
      `MATCH (c:Company {name: $name})
       OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
       OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
       RETURN c.name AS name, c.domain AS domain, c.segment AS segment, c.tier AS tier,
              collect(DISTINCT s.description) AS signals,
              collect(DISTINCT a.name) AS applications`,
      { name: companyName },
    );

    if (result.records.length === 0) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: `Company "${companyName}" not found` } });
    }

    const record = result.records[0];
    const input = {
      companyName: record.get("name"),
      domain: record.get("domain") || `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      segment: record.get("segment") || undefined,
      tier: record.get("tier") || undefined,
      signals: (record.get("signals") ?? []).filter(Boolean).slice(0, 10),
      applications: record.get("applications") ?? [],
    };

    const finder = getContactFinder();
    const found = await finder.findContacts(input);

    return res.json({ ok: true, data: found });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: { code: "FIND_CONTACTS_FAILED", message: err.message } });
  } finally {
    await session.close();
  }
});

// ── POST /agents/outreach/run ─────────────────────────────────────────────────
// Full outreach batch: qualify → find contacts → generate email → create preference link

router.post("/outreach/run", async (_req: Request, res: Response): Promise<any> => {
  const session = driver.session();
  try {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const scoredCompanies = await scoreAll();

    const contactCheck = await session.run(
      `MATCH (c:Company)<-[:CONTACT_AT]-(:Contact)
       RETURN c.name AS name`,
    );
    const hasContact = new Set(contactCheck.records.map((r) => r.get("name")));

    const signalCheck = await session.run(
      `MATCH (c:Company)
       OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
       WITH c, count(s) AS signalCount
       WHERE signalCount = 0
       RETURN c.name AS name`,
    );
    const noSignals = new Set(signalCheck.records.map((r) => r.get("name")));
    const qualified = scoredCompanies
      .filter((c) => (c.tier === "HOT" || c.tier === "WARM"))
      .filter((c) => !hasContact.has(c.companyName))
      .filter((c) => !noSignals.has(c.companyName))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5)
      .map((c) => ({
        name: c.companyName,
        totalScore: c.totalScore,
        tier: c.tier,
      }));

    if (qualified.length === 0) {
      return res.json({ ok: true, data: { qualified: [], message: "No qualified leads found" } });
    }

    // Step 2: Find contacts for each qualified company
    const finder = getContactFinder();
    const batchResults = [];

    for (const company of qualified) {
      // Fetch actual signals + applications
      const detailResult = await session.run(
        `MATCH (c:Company {name: $name})
         OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
         OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
         RETURN c.domain AS domain, c.segment AS segment,
                collect(DISTINCT s.description) AS signals,
                collect(DISTINCT a.name) AS applications`,
        { name: company.name },
      );

      const record = detailResult.records[0];
      const domain = record?.get("domain") ?? `${company.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
      const segment: string | null = record?.get("segment") ?? null;
      const signals = (record?.get("signals") ?? []).filter(Boolean).slice(0, 10);
      const applications = record?.get("applications") ?? [];

      const contacts = await finder.findContacts({
        companyName: company.name,
        domain,
        segment: segment ?? undefined,
        tier: company.tier,
        signals,
        applications,
      });

      let emailDraft: string | null = null;
      if (contacts.contacts.length > 0 && contacts.contacts[0].email) {
        try {
          emailDraft = await generateOutreachEmail({
            name: company.name,
            segment: segment || "BioTech Firm",
            strongestSignal: signals[0] || "Recent market activity",
            matchedLine: applications.includes("Hemostasis") ? "Hemostasis" : "Plasma Proteins",
            tier: (company.tier as "HOT" | "WARM") || "WARM",
            matchedItemsCount: applications.length || 6,
          });
        } catch {
          emailDraft = null;
        }
      }

      batchResults.push({
        company: company.name,
        tier: company.tier,
        score: company.totalScore,
        contactsFound: contacts.contacts.length,
        contacts: contacts.contacts,
        emailGenerated: emailDraft !== null,
        emailPreview: emailDraft ? emailDraft.substring(0, 200) + "..." : null,
      });
    }

    return res.json({
      ok: true,
      data: {
        totalQualified: qualified.length,
        results: batchResults,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: { code: "OUTREACH_BATCH_FAILED", message: err.message } });
  } finally {
    await session.close();
  }
});

export default router;
