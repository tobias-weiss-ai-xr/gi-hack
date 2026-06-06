import { Router, Request, Response } from "express";
import neo4j from "neo4j-driver";
import { getContactFinder } from "../services/agents/contactFinder.js";
import { generateOutreachEmail } from "../services/ai/outreach.js";
import { sendEmail } from "../services/agents/emailSender.js";
import { qualifyLeads } from "../services/agents/leadQualifier.js";
import { buildCompanyProfile } from "../services/agents/companyProfiler.js";

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
    const qualified = await qualifyLeads(session, 5);
    if (qualified.length === 0) {
      return res.json({ ok: true, data: { qualified: [], message: "No qualified leads found" } });
    }

    const finder = getContactFinder();
    const batchResults = [];

    for (const company of qualified) {
      const profile = await buildCompanyProfile(session, company);

      const contacts = await finder.findContacts({
        companyName: profile.name,
        domain: profile.domain,
        segment: profile.segment ?? undefined,
        tier: profile.tier,
        signals: profile.signals.slice(0, 10),
        applications: profile.applications,
      });

      let emailDraft: string | null = null;
      if (contacts.contacts.length > 0 && contacts.contacts[0].email) {
        try {
          emailDraft = await generateOutreachEmail({
            name: profile.name,
            segment: profile.segment || "BioTech Firm",
            strongestSignal: profile.strongestSignal,
            matchedLine: profile.matchedProductLine,
            tier: profile.tier,
            matchedItemsCount: profile.applications.length || 6,
          });

          if (emailDraft) {
            try {
              await sendEmail({ to: contacts.contacts[0].email, subject: `Partnership opportunity: ${profile.name} × GI-Hack`, body: emailDraft, from: "partnerships@gi-hack.com" });

              // Create OUTREACH_SENT record for cooldown tracking
              await session.run(
                `MATCH (c:Company {name: $name})
                 CREATE (o:Outreach {
                   id: randomUUID(),
                   date: toString(datetime()),
                   type: 'email',
                   contactEmail: $email,
                   preview: $preview
                 })
                 CREATE (c)-[:OUTREACH_SENT]->(o)`,
                { name: profile.name, email: contacts.contacts[0].email, preview: emailDraft.substring(0, 100) },
              );
            } catch {
              // Email send failure is non-fatal
            }
          }
        } catch {
          emailDraft = null;
        }
      }

      batchResults.push({
        company: profile.name,
        tier: profile.tier,
        score: profile.totalScore,
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

// ── POST /agents/preferences/generate-token ───────────────────────────────────
router.post("/preferences/generate-token", async (req: Request, res: Response): Promise<any> => {
  const { contactId, companyName, contactName, email, role } = req.body;
  if (!contactId || !companyName) {
    return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "contactId and companyName are required" } });
  }
  try {
    const { generateToken } = await import("../services/agents/preferences.js");
    const result = generateToken({ contactId, companyName, contactName, email, role });
    return res.json({ ok: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: { code: "TOKEN_FAILED", message: err.message } });
  }
});

// ── POST /agents/preferences/validate ─────────────────────────────────────────
router.post("/preferences/validate", async (req: Request, res: Response): Promise<any> => {
  const { contactId, token } = req.body;
  if (!contactId || !token) {
    return res.status(400).json({ ok: false, data: { valid: false } });
  }
  try {
    const { validateToken } = await import("../services/agents/preferences.js");
    const result = validateToken(token, contactId);
    return res.json({ ok: true, data: result });
  } catch {
    return res.json({ ok: true, data: { valid: false } });
  }
});

// ── POST /agents/preferences/submit ───────────────────────────────────────────
router.post("/preferences/submit", async (req: Request, res: Response): Promise<any> => {
  const { contactId, token, consentGiven, preferredContactMethod, interestLevel, areasOfInterest, timeline, additionalNotes } = req.body;
  if (!contactId || !token) {
    return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "contactId and token are required" } });
  }
  if (!consentGiven) {
    return res.status(400).json({ ok: false, error: { code: "CONSENT_REQUIRED", message: "Consent must be given" } });
  }
  const session = driver.session();
  try {
    const { consumeToken } = await import("../services/agents/preferences.js");
    const stored = consumeToken(token);
    if (!stored || stored.contactId !== contactId) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_TOKEN", message: "Token expired or invalid" } });
    }

    // Update Contact node in Neo4j with preferences
    await session.run(
      `MERGE (c:Contact {id: $contactId})
       SET c.name = $name,
           c.email = $email,
           c.role = $role,
           c.consentGiven = true,
           c.consentDate = toString(datetime()),
           c.preferredContactMethod = $method,
           c.interestLevel = $interest,
           c.interestedAreas = $areas,
           c.timeline = $timeline,
           c.additionalNotes = $notes`,
      { contactId, name: stored.contactName, email: stored.email, role: stored.role, method: preferredContactMethod || "email", interest: interestLevel || "medium", areas: areasOfInterest || [], timeline: timeline || "exploring", notes: additionalNotes || "" },
    );

    await session.run(
      `MATCH (c:Contact {id: $contactId})
       CREATE (a:Activity {
         id: randomUUID(),
         type: 'PREFERENCE_CONFIRMED',
         note: 'Customer confirmed communication preferences. Consent: ' + toString($consentGiven) + ', Method: ' + $method,
         date: toString(datetime())
       })
       CREATE (c)-[:HAS_ACTIVITY]->(a)`,
      { contactId, consentGiven, method: preferredContactMethod || "email" },
    );

    // If interest level is not 'exploring', advance to Contacted stage
    const advanceStages = new Set(["high", "medium"]);
    if (advanceStages.has(interestLevel || "")) {
      const stageResult = await session.run(
        `MATCH (c:Contact {id: $contactId})-[:IN_STAGE]->(s:PipelineStage)
         RETURN s.stage AS stage`,
        { contactId },
      );
      const currentStage = stageResult.records[0]?.get("stage");
      if (currentStage === "New") {
        await session.run(
          `MATCH (c:Contact {id: $contactId})-[r:IN_STAGE]->(s:PipelineStage)
           DELETE r, s
           WITH c
           CREATE (c)-[:IN_STAGE]->(:PipelineStage {stage: 'Contacted', enteredAt: toString(datetime())})`,
          { contactId },
        );
      }
    }

    return res.json({ ok: true, data: { success: true } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: { code: "SUBMIT_FAILED", message: err.message } });
  } finally {
    await session.close();
  }
});

export default router;
