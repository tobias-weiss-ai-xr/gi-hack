import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactCandidate {
  name: string;
  role: string;
  email: string | null;
  confidence: number; // 0–1
  source: "llm" | "scrape" | "pattern" | "api";
}

export interface ContactFinderInput {
  companyName: string;
  domain: string;
  segment?: string;
  tier?: string;
  signals: string[]; // top signal descriptions
  applications?: string[];
}

export interface ContactFinderResult {
  companyName: string;
  contacts: ContactCandidate[];
  method: string;
}

// ─── Strategy Interface (pluggable) ──────────────────────────────────────────

export interface ContactFinderStrategy {
  name: string;
  find(input: ContactFinderInput): Promise<ContactCandidate[]>;
}

// ─── Strategy 1: LLM-based contact suggestion (primary) ──────────────────────

export class LLMContactStrategy implements ContactFinderStrategy {
  name = "llm";

  async find(input: ContactFinderInput): Promise<ContactCandidate[]> {
    const systemPrompt = `
You are a B2B sales intelligence agent for Siemens Healthineers Marburg.
Your task is to suggest realistic R&D and procurement contacts for a target diagnostics company.

Given the company profile below, return a JSON array of likely contacts.
Only include roles that typically exist in a diagnostics/IVD/biotech company.

For each contact, provide:
- name: A realistic full name (first + last) appropriate for the company's country/region
- role: A specific job title (e.g. "Head of Assay Development", "VP of R&D", "Director of Procurement")
- email: Generate the most likely email address using common corporate patterns (firstname.lastname@domain, f.lastname@domain, etc.)
- confidence: A score 0–1 based on how likely this specific role exists at a company of this size

Rules:
- Prefer R&D leadership: Head of R&D, Director of Assay Development, VP of Diagnostics
- Include procurement if the company is large enough (Pharma, CDMO)
- 2–4 contacts max
- Return ONLY valid JSON array, no markdown, no extra text.

Schema:
[{"name": "string", "role": "string", "email": "string|null", "confidence": 0.0}]
`;

    const signalSummary = input.signals.slice(0, 5).join("; ") || "No signals available";

    try {
      const { text } = await generateText({
        model: openai("gpt-4o"),
        system: systemPrompt,
        prompt: `
Company: ${input.companyName}
Domain: ${input.domain}
Segment: ${input.segment ?? "Unknown"}
Tier: ${input.tier ?? "Unknown"}
Applications: ${(input.applications ?? []).join(", ") || "Unknown"}
Key signals: ${signalSummary}
        `.trim(),
        temperature: 0.2,
      });

      const parsed = JSON.parse(text.trim());
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((c: any) => c.name && c.role)
        .map((c: any) => ({
          name: c.name,
          role: c.role,
          email: c.email && typeof c.email === "string" && c.email.includes("@")
            ? c.email.toLowerCase()
            : null,
          confidence: Math.min(1, Math.max(0, c.confidence ?? 0.3)),
          source: "llm" as const,
        }));
    } catch {
      return [];
    }
  }
}

// ─── Strategy 2: LinkedIn search (fallback — placeholder) ─────────────────────
// TODO: Implement LinkedIn API/playwright scraping for contact discovery.
//   Strategy: search company page → people tab → extract names/roles.
//   Requires: LinkedIn session cookie or Proxycurl API key.

export class LinkedInStrategy implements ContactFinderStrategy {
  name = "linkedin";

  async find(_input: ContactFinderInput): Promise<ContactCandidate[]> {
    // Placeholder — returns empty, allowing chain to continue
    return [];
  }
}

// ─── Strategy 3: Web scraping with Playwright (fallback 1) ────────────────────

export class WebScrapeStrategy implements ContactFinderStrategy {
  name = "scrape";

  async find(input: ContactFinderInput): Promise<ContactCandidate[]> {
    if (!input.domain) return [];

    const url = `https://${input.domain}`;
    let html = "";

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      html = await resp.text();
    } catch {
      return [];
    }

    const candidates: ContactCandidate[] = [];

    // Look for email addresses in the page
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [...new Set(html.match(emailRegex) ?? [])]
      .filter((e) => !e.includes("example.com") && !e.includes("domain.com"))
      .slice(0, 5);

    for (const email of emails) {
      // Try to extract a name from the email
      const localPart = email.split("@")[0];
      const nameGuess = localPart
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();

      candidates.push({
        name: nameGuess || "Unknown",
        role: "Unknown (scraped)",
        email,
        confidence: 0.5,
        source: "scrape",
      });
    }

    // Look for "team", "about", "contact" page links
    const linkRegex = /href=["']([^"']*(?:team|about|contact|people|leadership)[^"']*)["']/gi;
    const links = [...new Set(html.match(linkRegex) ?? [])].slice(0, 3);

    if (links.length > 0) {
      candidates.push({
        name: `Found team/contact pages: ${links.length}`,
        role: "See website",
        email: null,
        confidence: 0.3,
        source: "scrape",
      });
    }

    return candidates;
  }
}

// ─── Strategy 3: Email pattern generator (lightweight fallback) ──────────────

const EMAIL_PATTERNS = [
  (first: string, last: string, domain: string) => `${first}.${last}@${domain}`,
  (first: string, last: string, domain: string) => `${first[0]}.${last}@${domain}`,
  (first: string, _last: string, domain: string) => `${first}@${domain}`,
  (first: string, last: string, domain: string) => `${first}${last[0]}@${domain}`,
  (_first: string, last: string, domain: string) => `${last}@${domain}`,
];

function generateEmail(name: string, domain: string): string {
  const parts = name.toLowerCase().trim().split(/\s+/);
  if (parts.length < 2 || !domain) return "";
  const first = parts[0];
  const last = parts[parts.length - 1];
  for (const pattern of EMAIL_PATTERNS) {
    const email = pattern(first, last, domain);
    if (email.length < `${first}@${domain}`.length + 5) continue;
    return email;
  }
  return `${first}.${last}@${domain}`;
}

export class PatternEmailStrategy implements ContactFinderStrategy {
  name = "pattern";

  async find(input: ContactFinderInput): Promise<ContactCandidate[]> {
    if (!input.domain) return [];
    return [
      {
        name: `R&D Director`,
        role: "Director of R&D",
        email: generateEmail("R&D Director", input.domain),
        confidence: 0.2,
        source: "pattern",
      },
      {
        name: `Procurement Manager`,
        role: "Procurement Manager",
        email: generateEmail("Procurement Manager", input.domain),
        confidence: 0.15,
        source: "pattern",
      },
    ];
  }
}

// ─── Orchestrator: runs strategies in order, merges results ───────────────────

export class ContactFinder {
  private strategies: ContactFinderStrategy[];

  constructor(strategies?: ContactFinderStrategy[]) {
    // LLM → web scrape → LinkedIn (placeholder) → pattern (last resort)
    this.strategies = strategies ?? [
      new LLMContactStrategy(),
      new WebScrapeStrategy(),
      new LinkedInStrategy(),
      new PatternEmailStrategy(),
    ];
  }

  /** Register a new strategy (pluggable). */
  use(strategy: ContactFinderStrategy): void {
    this.strategies.push(strategy);
  }

  /** Run all strategies, return merged deduplicated results. */
  async findContacts(input: ContactFinderInput): Promise<ContactFinderResult> {
    const allContacts: ContactCandidate[] = [];
    let usedMethod = "none";

    for (const strategy of this.strategies) {
      try {
        const contacts = await strategy.find(input);
        if (contacts.length > 0) {
          allContacts.push(...contacts);
          usedMethod = strategy.name;
          // LLM results are good enough — stop there
          if (strategy.name === "llm") break;
        }
      } catch {
        // Strategy failed — try next
        continue;
      }
    }

    // Deduplicate by email
    const seen = new Set<string>();
    const unique = allContacts.filter((c) => {
      const key = c.email ?? c.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by confidence descending
    unique.sort((a, b) => b.confidence - a.confidence);

    return {
      companyName: input.companyName,
      contacts: unique,
      method: usedMethod,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let defaultFinder: ContactFinder | null = null;

export function getContactFinder(): ContactFinder {
  if (!defaultFinder) {
    defaultFinder = new ContactFinder();
  }
  return defaultFinder;
}
