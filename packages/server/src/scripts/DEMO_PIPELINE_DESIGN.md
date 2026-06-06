# Pipeline MVP Demo Design

**Date:** 2026-06-06
**Branch:** feature/pipeline-mvp
**Goal:** Create realistic demo data for hackathon presentation with easy customer engagement

---

## Problem Statement

The pipeline CRM exists but has no data. For the hackathon demo, we need:
- Realistic leads that visitors can interact with immediately
- Plausible activity history showing progression
- Evidence of the lead scoring system working (HOT/WARM/COLD tiers)
- Easy "aha moment" for customers to see the value

---

## Design: Mock Data Generation

### Strategy

Instead of requiring manual data entry or real API calls, we'll create:
1. **A "demo bootstrap" script** that generates 8-10 realistic leads across all pipeline stages
2. **Pre-seeded activity history** showing natural progression
3. **Company profiles** drawn from existing Neo4j companies (with enriched data)
4. **Realistic contact information** that feels authentic to the target market

### Lead Distribution

| Stage | Lead Count | Company Types |
|-------|-----------|---------------|
| New | 2 | HOT tier IVD companies |
| Contacted | 2 | WARM tier companies |
| Meeting | 2 | HIGH engagement (multiple activities) |
| Proposal | 1 | Complex deal with sourcing |
| Closed Won | 1 | Success story with detailed history |
| Closed Lost | 1 | Learning opportunity |

**Total: 10 leads**

###每个Lead的数据结构

For each demo lead, we generate:
```
- Contact: name, email, role (R&D Lead, CTO, Director)
- Company: existing Neo4j company reference (real domain, segment)
- Stage: current pipeline stage
- Stage entered: realistic dates (staggered over 2 months)
- Activities: 3-8 activity entries showing progression
  - STAGE_CHANGE entries when stage moves
  - EMAIL exchanges (outreach, replies)
  - MEETING notes (tech validation, sample requests)
  - CALL follow-ups
  - NOTE entries (research findings)
```

### Activity Patterns by Stage

**New → Contacted:**
- Initial outreach email generated (mentioning strongest signal)
- Email reply or LinkedIn connection
- NOTE: "Research confirmed - strong fit for hemostasis products"

**Contacted → Meeting:**
- MEETING: "Technical validation call - discussed Factor VII needs"
- EMAIL: "Sample validation kit sent via courier"
- NOTE: "Competitor comparison - Siemens pricing competitive"

**Meeting → Proposal:**
- MEETING: "5-year contract discussion - scaling pipeline"
- EMAIL: "Draft proposal sent for review"
- NOTE: "Portfolio cross-sell: 17 matching items identified"

**Proposal → Closed Won:**
- MEETING: "Contract signing with procurement team"
- EMAIL: "Welcome aboard - onboarding scheduled"
- NOTE: "Initial order: 3 bulk proteins, 12 antibodies"

**Meeting → Closed Lost:**
- EMAIL: "Vendor evaluation - chose competitor due to existing relationship"
- NOTE: "Keep warm - re-engage in 6 months"
- CALL: "Feedback call for learning"

---

## Implementation Plan

### 1. Mock Data Generator Script

**File:** `packages/server/src/scripts/create-demo-pipeline.ts`

**Functionality:**
```typescript
- Select 10 existing Neo4j companies (mix of tiers if available)
- Generate realistic contacts for each (German names, IVD roles)
- Create activity timeline with appropriate patterns
- Insert into Neo4j using existing pipeline functions
- Output summary of created leads
```

**Contact Names (realistic for DACH IVD market):**
```
Dr. Anna Müller - R&D Director
Markus Wagner - Head of Assay Development
Dr. Sophie Weber - CTO
Thomas Fischer - Director of Diagnostics
Dr. Julia Schmidt - VP R&D
Michael Klein - Product Lead
Dr. Nora Hoffmann - Chief Scientific Officer
Alexander Braun - Lead Scientist
Dr. Katharina Wolf - Director of Quality
Stefan Richter - Business Development
```

**Email Domains:** Use company domains from Neo4j where available, fall back to `{company}.de` pattern for demo.

### 2. Demo Script Execution

**CLI Command:**
```bash
npm run demo:pipeline
```

**Process:**
1. Connect to Neo4j
2. Ensure pipeline stages exist
3. Create 10 demo leads
4. Print summary for demo presenter:
   ```
   ✓ Created 10 demo leads
   ✓ 2 New, 2 Contacted, 2 Meeting, 1 Proposal, 1 Won, 1 Lost
   ✓ Total activities: 47
   Ready for demo!
   ```
5. Exit cleanly

### 3. Company Selection Logic

To ensure realism:
- Prefer companies with existing signals (HAS_SIGNAL relationships)
- Prefer companies with applications (DEVELOPS relationships)
- If not enough suitable companies, create fallback demo-specific companies
- Ensure diversity: IVD manufacturers, CDMOs, biotech startups

---

## Demo Presentation Flow

### For Hackathon Judge

1. **Show Dashboard** → "We've identified 1,296 companies, scored them into tiers"
2. **Show Lead List** → Filter HOT leads → "These are our highest priority targets"
3. **Click "Add to Pipeline"** on a HOT lead → "Seamless handoff to sales CRM"
4. **Navigate to Pipeline** → "Here's where our sales team tracks engagement"
5. **Drag card across stages** → "Visual kanban, reduces clutter"
6. **Click a card** → Activity modal with full history
7. **Add a note** → "Real-time collaboration across the team"
8. **Show "Closed Won" card** → "This one converted, here's the history..."

### Customer Value Highlighted

- **Data-driven targeting** (graph-based scoring)
- **Seamless workflow** (one-click from lead to pipeline)
- **Collaborative** (shared activity history)
- **Flexible** (drag-and-drop, regress capability)
- **Rich context** (all signals, tier info, notes in one place)

---

## Technical Notes

### Dependencies

- Uses existing `pipeline/index.ts` functions (ensurePipelineStages, startPipeline, addActivity)
- No new database schema required
- Idempotent: can run multiple times (checks for existing contacts)

### Fallback Behavior

If Neo4j is empty or lacks companies:
- Create 5 demo companies with realistic profiles
- Seed them into the graph first
- Then create pipeline leads for them

### Data Cleanliness

- All dates are ISO-8601 strings
- All contact IDs are UUIDs
- All activity IDs are UUIDs
- No special characters that might break Cypher

---

## Success Criteria

✅ Script runs in < 3 seconds
✅ Creates 10 realistic leads
✅ Each lead has 3-8 activity entries
✅ Leads distributed across all 6 stages
✅ UI immediately shows populated kanban board
✅ Demo presenter can interactively move cards
✅ Activity history feels authentic and tells a story

---

## Future Extensions (Post-Hackathon)

- Real-time sync with outreach emails (email hooks)
- Automated activity logging from email threads
- Stage time analytics (conversion rates by stage)
- User assignment to leads
- Email notifications for stage changes
- Forecasting from pipeline data
