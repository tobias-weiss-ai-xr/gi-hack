# Sisyphus Anchor Summary — GI-Hack

## Current State (Fri Jun 5 2026)

### What's Been Built (latest round)

**Critical fixes:**
- Outreach email now embeds the preference form URL in the email body (contacts can actually click the link)
- Outreach uses real Neo4j `Contact.id` instead of synthetic `outreach-{timestamp}` IDs — preference links match real contacts
- Outreach errors per-company are collected in `errors[]` array in response, not silently swallowed in triple-nested try/catch
- Each contacted company gets NaN result even when per-company step fails

**Preference update flow:**
- `validateToken` no longer rejects consumed tokens — returns `alreadySubmitted: true` instead
- New `PUT /preferences/update` — update preferences without re-consuming the token (uses `getTokenInfo`)
- New `POST /preferences/withdraw` — marks consent as false, records withdrawal timestamp
- Frontend: `alreadySubmitted` state detected on page load, shows "Already Submitted" screen with "Update Preferences" button
- Frontend: update endpoint used when re-submitting, "Update Preferences" button text
- Frontend: success page has "Need to update?" and "Withdraw consent" links

**Neo4j-backed token persistence:**
- Tokens are persisted to Neo4j `PreferenceToken` nodes as fire-and-forget on every create/consume
- On server startup, tokens are loaded from Neo4j into memory (survives restarts)
- Configurable via `setNeo4jSessionFactory()` — falls back to in-memory-only if Neo4j unavailable

**Webhooks (no longer stubs):**
- `POST /webhooks/outbound-email` — stores delivery events as `EmailEvent` nodes in Neo4j
- `POST /webhooks/email-unsubscribe` — marks Contact as unsubscribed + records `EmailEvent`

### Known Gaps
- [~] Email provider — mock is fine for demo (interface ready for Resend/SendGrid/SES)
- [ ] Tests — preference token service, lead qualifier have logic worth testing
- [x] All previously identified gaps resolved
