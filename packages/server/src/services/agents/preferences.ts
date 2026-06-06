import crypto from "node:crypto";

// ─── Token types ──────────────────────────────────────────────────────────────

interface StoredToken {
  contactId: string;
  companyName: string;
  contactName: string;
  email: string;
  role: string;
  expiresAt: Date;
  used: boolean;
}

// ─── In-memory token store (fast primary) ──────────────────────────────────────

const tokenStore = new Map<string, StoredToken>();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [token, data] of tokenStore) {
    if (data.expiresAt < now) tokenStore.delete(token);
  }
}, 5 * 60 * 1000);

// ─── Optional Neo4j persistence ────────────────────────────────────────────────

let neo4jSessionFactory: (() => any) | null = null;

export function setNeo4jSessionFactory(fn: () => any): void {
  neo4jSessionFactory = fn;
}

async function persistToNeo4j(token: string, data: StoredToken): Promise<void> {
  if (!neo4jSessionFactory) return;
  const session = neo4jSessionFactory();
  try {
    await session.run(
      `MERGE (t:PreferenceToken {token: $token})
       SET t.contactId = $contactId,
           t.companyName = $companyName,
           t.contactName = $contactName,
           t.email = $email,
           t.role = $role,
           t.expiresAt = toString($expiresAt),
           t.used = $used,
           t.createdAt = toString(datetime())`,
      {
        token,
        contactId: data.contactId,
        companyName: data.companyName,
        contactName: data.contactName,
        email: data.email,
        role: data.role,
        expiresAt: data.expiresAt.toISOString(),
        used: data.used,
      },
    );
  } finally {
    await session.close();
  }
}

export async function loadTokensFromNeo4j(): Promise<number> {
  if (!neo4jSessionFactory) return 0;
  const session = neo4jSessionFactory();
  try {
    const result = await session.run(
      `MATCH (t:PreferenceToken)
       WHERE t.expiresAt > toString(datetime())
       RETURN t.token AS token, t.contactId AS contactId,
              t.companyName AS companyName, t.contactName AS contactName,
              t.email AS email, t.role AS role,
              t.expiresAt AS expiresAt, t.used AS used`,
    );
    let loaded = 0;
    for (const record of result.records) {
      const r = record as any;
      const expiresAt = new Date(r.expiresAt);
      if (expiresAt > new Date()) {
        tokenStore.set(r.token, {
          contactId: r.contactId,
          companyName: r.companyName,
          contactName: r.contactName,
          email: r.email,
          role: r.role,
          expiresAt,
          used: r.used === true || r.used === "true",
        });
        loaded++;
      }
    }
    return loaded;
  } finally {
    await session.close();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function generateToken(params: {
  contactId: string;
  companyName: string;
  contactName: string;
  email: string;
  role: string;
}): { token: string; expiresAt: Date; url: string } {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const stored: StoredToken = {
    contactId: params.contactId,
    companyName: params.companyName,
    contactName: params.contactName,
    email: params.email,
    role: params.role,
    expiresAt,
    used: false,
  };

  tokenStore.set(token, stored);
  persistToNeo4j(token, stored); // fire-and-forget

  return {
    token,
    expiresAt,
    url: `/preferences/${params.contactId}/${token}`,
  };
}

export function validateToken(token: string, contactId: string): {
  valid: boolean;
  alreadySubmitted?: boolean;
  companyName?: string;
  contactName?: string;
  email?: string;
  role?: string;
  areasOfInterest?: string[];
} {
  const stored = tokenStore.get(token);
  if (!stored) return { valid: false };
  if (stored.contactId !== contactId) return { valid: false };
  if (stored.expiresAt < new Date()) return { valid: false };

  return {
    valid: true,
    alreadySubmitted: stored.used,
    companyName: stored.companyName,
    contactName: stored.contactName,
    email: stored.email,
    role: stored.role,
    areasOfInterest: [
      "Bulk proteins",
      "Antibodies",
      "Latex particles",
      "Blockers",
      "Custom formulation",
    ],
  };
}

export function consumeToken(token: string): StoredToken | null {
  const stored = tokenStore.get(token);
  if (!stored) return null;
  if (stored.expiresAt < new Date()) return null;
  stored.used = true;
  persistToNeo4j(token, stored); // fire-and-forget
  return stored;
}

export function getTokenInfo(token: string): StoredToken | null {
  const stored = tokenStore.get(token);
  if (!stored || stored.expiresAt < new Date()) return null;
  return stored;
}
