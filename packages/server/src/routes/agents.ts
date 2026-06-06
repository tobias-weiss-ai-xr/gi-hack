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

// Initialize token persistence — load tokens from Neo4j on startup
(async () => {
  try {
    const { setNeo4jSessionFactory, loadTokensFromNeo4j } = await import("../services/agents/preferences.js");
    setNeo4jSessionFactory(() => driver.session());
    const loaded = await loadTokensFromNeo4j();
    if (loaded > 0) console.log(`  [preferences] Loaded ${loaded} tokens from Neo4j`);
  } catch {
    // Neo4j token store not available — using in-memory only
  }
})();

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
// Full outreach batch: qualify → find contacts → upsert contacts → generate email with preference link

router.post("/outreach/run", async (_req: Request, res: Response): Promise<any> => {
  const session = driver.session();
  const errors: { company: string; error: string }[] = [];
  try {
    const qualified = await qualifyLeads(session, 5);
    if (qualified.length === 0) {
      return res.json({ ok: true, data: { qualified: [], message: "No qualified leads found" } });
    }

    const finder = getContactFinder();
    const batchResults = [];

    for (const company of qualified) {
      try {
        const profile = await buildCompanyProfile(session, company);

        const contacts = await finder.findContacts({
          companyName: profile.name,
          domain: profile.domain,
          segment: profile.segment ?? undefined,
          tier: profile.tier,
          signals: profile.signals.slice(0, 10),
          applications: profile.applications,
        });

        let emailResult: {
          sent: boolean;
          contactId?: string;
          contactEmail?: string;
          preferenceUrl?: string;
          emailPreview?: string;
        } | null = null;

        if (contacts.contacts.length > 0 && contacts.contacts[0].email) {
          const candidate = contacts.contacts[0];
          const emailDraft = await generateOutreachEmail({
            name: profile.name,
            segment: profile.segment || "BioTech Firm",
            strongestSignal: profile.strongestSignal,
            matchedLine: profile.matchedProductLine,
            tier: profile.tier,
            matchedItemsCount: profile.applications.length || 6,
          });

          if (emailDraft) {
            // UPSERT contact into Neo4j (match by email, create if new)
            const contactResult = await session.run(
              `MATCH (co:Company {name: $companyName})
               MERGE (c:Contact {email: $email})
               ON CREATE SET c.id = randomUUID(), c.name = $name, c.role = $role
               ON MATCH SET c.name = COALESCE(c.name, $name), c.role = COALESCE(c.role, $role)
               MERGE (c)-[:CONTACT_AT]->(co)
               RETURN c.id AS contactId`,
              { companyName: profile.name, email: candidate.email, name: candidate.name, role: candidate.role },
            );
            const contactId = (contactResult.records[0] as any)?.contactId;
            if (!contactId) throw new Error("Failed to get contactId from Neo4j");

            // Generate preference token with REAL contactId
            const { generateToken } = await import("../services/agents/preferences.js");
            const tokenResult = generateToken({
              contactId,
              companyName: profile.name,
              contactName: candidate.name,
              email: candidate.email ?? "",
              role: candidate.role ?? "",
            });

            const preferenceUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}${tokenResult.url}`;

            // Append preference link to email body
            const subject = `Partnership opportunity: ${profile.name} × GI-Hack`;
            const bodyWithLink = `${emailDraft}\n\n---\n📋 Let us know your preferences: ${preferenceUrl}\n\nThis link expires in 7 days.`;

            await sendEmail({ to: candidate.email ?? "", subject, body: bodyWithLink, from: "partnerships@gi-hack.com" });

            // Create OUTREACH_SENT activity on the Contact
            await session.run(
              `MATCH (c:Contact {id: $contactId})
               CREATE (a:Activity {
                 id: randomUUID(),
                 type: 'OUTREACH_SENT',
                 note: $note,
                 date: toString(datetime())
               })
               CREATE (c)-[:HAS_ACTIVITY]->(a)`,
              { contactId, note: `Outreach email sent to ${candidate.email} — preference link: ${preferenceUrl}` },
            );

            // Set next outreach cooldown
            await session.run(
              `MATCH (c:Contact {id: $contactId})
               SET c.nextOutreachAt = toString(datetime() + duration('P30D'))`,
              { contactId },
            );

            // Create Outreach node linked to Company
            await session.run(
              `MATCH (c:Company {name: $name})
               CREATE (o:Outreach {
                 id: randomUUID(),
                 date: toString(datetime()),
                 emailSubject: $subject,
                 formUrl: $formUrl,
                 token: $token,
                 type: 'email',
                 contactEmail: $email,
                 contactId: $contactId,
                 preview: $preview
               })
               CREATE (c)-[:OUTREACH_SENT]->(o)`,
              {
                name: profile.name,
                subject,
                formUrl: tokenResult.url,
                token: tokenResult.token,
                email: candidate.email,
                contactId,
                preview: emailDraft.substring(0, 100),
              },
            );

            emailResult = {
              sent: true,
              contactId,
              contactEmail: candidate.email ?? undefined,
              preferenceUrl,
              emailPreview: emailDraft.substring(0, 200),
            };
          }
        }

        batchResults.push({
          company: profile.name,
          tier: profile.tier,
          score: profile.totalScore,
          contactsFound: contacts.contacts.length,
          email: emailResult,
        });
      } catch (err: any) {
        const msg = err.message || "Unknown error";
        errors.push({ company: company.name || "unknown", error: msg });
        batchResults.push({
          company: company.name || "unknown",
          error: msg,
        });
      }
    }

    return res.json({
      ok: true,
      data: {
        totalQualified: qualified.length,
        results: batchResults,
        errors: errors.length > 0 ? errors : undefined,
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
  const { contactId, token, name, email, role, consentGiven, preferredContactMethod, interestLevel, areasOfInterest, timeline, additionalNotes } = req.body;
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
      { contactId, name: name || stored.contactName, email: email || stored.email, role: role || stored.role, method: preferredContactMethod || "email", interest: interestLevel || "medium", areas: areasOfInterest || [], timeline: timeline || "exploring", notes: additionalNotes || "" },
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

// ── PUT /agents/preferences/update ─────────────────────────────────────────────

router.put("/preferences/update", async (req: Request, res: Response): Promise<any> => {
  const { contactId, token, name, email, role, preferredContactMethod, interestLevel, areasOfInterest, timeline, additionalNotes } = req.body;
  if (!contactId || !token) {
    return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "contactId and token are required" } });
  }
  const session = driver.session();
  try {
    const { getTokenInfo } = await import("../services/agents/preferences.js");
    const stored = getTokenInfo(token);
    if (!stored || stored.contactId !== contactId) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_TOKEN", message: "Token expired or invalid" } });
    }

    await session.run(
      `MERGE (c:Contact {id: $contactId})
       SET c.name = $name,
           c.email = $email,
           c.role = $role,
           c.preferredContactMethod = $method,
           c.interestLevel = $interest,
           c.interestedAreas = $areas,
           c.timeline = $timeline,
           c.additionalNotes = $notes`,
      { contactId, name: name || stored.contactName, email: email || stored.email, role: role || stored.role, method: preferredContactMethod || "email", interest: interestLevel || "medium", areas: areasOfInterest || [], timeline: timeline || "exploring", notes: additionalNotes || "" },
    );

    await session.run(
      `MATCH (c:Contact {id: $contactId})
       CREATE (a:Activity {
         id: randomUUID(),
         type: 'PREFERENCE_CONFIRMED',
         note: 'Customer updated communication preferences. Method: ' + $method,
         date: toString(datetime())
       })
       CREATE (c)-[:HAS_ACTIVITY]->(a)`,
      { contactId, method: preferredContactMethod || "email" },
    );

    return res.json({ ok: true, data: { success: true } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: { code: "UPDATE_FAILED", message: err.message } });
  } finally {
    await session.close();
  }
});

// ── POST /agents/preferences/withdraw ────────────────────────────────────────────

router.post("/preferences/withdraw", async (req: Request, res: Response): Promise<any> => {
  const { contactId } = req.body;
  if (!contactId) {
    return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "contactId is required" } });
  }
  const session = driver.session();
  try {
    await session.run(
      `MATCH (c:Contact {id: $contactId})
       SET c.consentGiven = false,
           c.consentWithdrawnAt = toString(datetime())`,
      { contactId },
    );
    await session.run(
      `MATCH (c:Contact {id: $contactId})
       CREATE (a:Activity {
         id: randomUUID(),
         type: 'PREFERENCE_CONFIRMED',
         note: 'Customer withdrew communication consent',
         date: toString(datetime())
       })
       CREATE (c)-[:HAS_ACTIVITY]->(a)`,
      { contactId },
    );
    return res.json({ ok: true, data: { success: true } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: { code: "WITHDRAW_FAILED", message: err.message } });
  } finally {
    await session.close();
  }
});

// ── GET /agents/outreach/schedule ─────────────────────────────────────────────
router.get("/outreach/schedule", async (_req: Request, res: Response): Promise<any> => {
  return res.json({
    ok: true,
    data: {
      mode: "manual",
      nextRun: null,
      description: "Outreach runs on-demand via POST /api/agents/outreach/run",
    },
  });
});

// ── GET /agents/outreach/stats ────────────────────────────────────────────────
router.get("/outreach/stats", async (_req: Request, res: Response): Promise<any> => {
  const session = driver.session();
  try {
    const [sentResult, consentResult, stageResult] = await Promise.all([
      session.run(`MATCH (o:Outreach) RETURN count(o) AS sent`),
      session.run(`MATCH (c:Contact) WHERE c.consentGiven = true RETURN count(c) AS consented`),
      session.run(
        `MATCH (c:Contact)-[:IN_STAGE]->(s:PipelineStage)
         RETURN s.stage AS stage, count(c) AS count
         ORDER BY s.stage`,
      ),
    ]);
    const sent = sentResult.records[0]?.get("sent").toNumber() ?? 0;
    const consented = consentResult.records[0]?.get("consented").toNumber() ?? 0;
    const byStage: Record<string, number> = {};
    for (const r of stageResult.records) {
      byStage[r.get("stage")] = r.get("count").toNumber();
    }
    return res.json({ ok: true, data: { sent, consented, responseRate: sent > 0 ? Math.round((consented / sent) * 100) : 0, byStage } });
  } finally {
    await session.close();
  }
});

// ── GET /agents/preferences/:contactId ─────────────────────────────────────────
router.get("/preferences/:contactId", async (req: Request, res: Response): Promise<any> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (c:Contact {id: $id})
       RETURN c { .* } AS contact`,
      { id: req.params.contactId },
    );
    if (!result.records[0]) {
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Contact not found" } });
    }
    return res.json({ ok: true, data: { contact: result.records[0].get("contact") } });
  } finally {
    await session.close();
  }
});

// ── POST /agents/webhooks/outbound-email ────────────────────────────────────────

router.post("/webhooks/outbound-email", async (req: Request, res: Response): Promise<any> => {
  const { eventType, recipient, messageId, timestamp } = req.body;
  const session = driver.session();
  try {
    await session.run(
      `CREATE (e:EmailEvent {
        id: randomUUID(),
        type: 'outbound_email',
        eventType: $eventType,
        recipient: $recipient,
        messageId: $messageId,
        timestamp: $timestamp,
        receivedAt: toString(datetime())
      })`,
      { eventType: eventType || "unknown", recipient: recipient || "unknown", messageId: messageId || "unknown", timestamp: timestamp || new Date().toISOString() },
    );
    return res.json({ ok: true, data: { recorded: true } });
  } finally {
    await session.close();
  }
});

// ── POST /agents/webhooks/email-unsubscribe ─────────────────────────────────────
// Processes unsubscribe requests from email provider

router.post("/webhooks/email-unsubscribe", async (req: Request, res: Response): Promise<any> => {
  const { email, reason } = req.body;
  const session = driver.session();
  try {
    await session.run(
      `MATCH (c:Contact {email: $email})
       SET c.unsubscribed = true, c.unsubscribedAt = toString(datetime()), c.unsubscribeReason = $reason`,
      { email: email || "", reason: reason || "not specified" },
    );
    await session.run(
      `CREATE (e:EmailEvent {
        id: randomUUID(),
        type: 'unsubscribe',
        email: $email,
        reason: $reason,
        receivedAt: toString(datetime())
      })`,
      { email: email || "", reason: reason || "not specified" },
    );
    return res.json({ ok: true, data: { unsubscribed: true } });
  } finally {
    await session.close();
  }
});

export default router;
