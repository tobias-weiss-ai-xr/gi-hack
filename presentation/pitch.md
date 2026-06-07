---
marp: true
theme: uncover
class:
  - lead
  - invert
paginate: true
backgroundColor: #0f1117
color: "#e0e0e0"
style: |
  section {
    font-family: 'DM Sans', system-ui, sans-serif;
  }
  h1 { color: #f0f0f0; }
  h2 { color: #a5b4fc; }
  h3 { color: #818cf8; }
  a { color: #6366f1; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
  .highlight { color: #f97316; font-weight: 700; }
  .accent { color: #818cf8; font-weight: 600; }
  .success { color: #86efac; font-weight: 600; }
  .point { color: #fbbf24; }
  table { font-size: 0.75rem; margin: 0 auto; }
  th { color: #a5b4fc; background: rgba(99,102,241,0.1); }
  td { background: rgba(255,255,255,0.03); }
  blockquote { border-left: 4px solid #6366f1; background: rgba(99,102,241,0.08); padding: 0.5rem 1rem; }
  .speaker { font-size: 0.65rem; color: #6366f1; margin-top: 0.25rem; }
  .big { font-size: 2.5rem; font-weight: 800; }
  footer { font-size: 0.5rem; color: #555; }
---

# LeadGraph

**AI-powered B2B Lead Identification**

Siemens Healthineers — StartMiUp Hackathon 2026

🛠️ Tobias · 🎨 Reyyan · 📋 Beyza · 🤖 Zeynep

![bg right:40%](teaser.png)

---

## ① The Problem

<div class="columns">
<div>

**"We have great products, but we don't know who needs them."**

- Siemens produces **biological intermediates** (proteins, antibodies, reagents) at Marburg
- **No B2B sales structure** — customers are diagnostic companies they've never heard of
- **Zero systematic lead generation** — relying on trade shows and word of mouth

</div>
<div>

**Why it matters**
- Market: **$75B+** diagnostic intermediates, 6% annual growth
- Each new assay = **$50K–500K/yr** in potential revenue
- **Thousands** of companies developing assays globally
- A new FDA clearance → that company **will need intermediates** within 6–12 months
- Today: **no way to know this is happening**

</div>
</div>

<div class="speaker">🎤 Speaker 1 (Tobias): 60s</div>

---

## ② The Solution — LeadGraph

<div class="columns">
<div>

**Knowledge Graph + AI Scoring**

- **12 data sources** scanned automatically: FDA 510(k), ClinicalTrials.gov, patents (EPO), research (OpenAlex), GitHub, DACH sources (DRKS, MEDICA, FÖKAT), more
- **Neo4j graph database** connects companies, signals, products, applications
- **4-factor scoring** → HOT / WARM / COLD tiers

</div>
<div>

**Architecture**

```
React (Dashboard, Explorer, Pipeline, Admin)
        ↕ REST API
Express Gateway (TypeScript)
        ↕ Bolt
Neo4j Knowledge Graph
        ↕ 12 adapters
FDA · Trials · Patents · Research
GitHub · MEDICA · DRKS · FÖKAT
```

</div>
</div>

<div class="speaker">🎤 Speaker 1 (Tobias): 60s</div>

---

## ③ How It Works — Scoring Engine

```
Signal Score   (0-40)  ← FDA clearances, patents, clinical trials, funding
Product Fit    (0-30)  ← How closely their assay matches Siemens products
Segment Bonus  (0-20)  ← IVD manufacturer = 20, CDMO = 15, Supplier = 10
Recency Bonus  (0-10)  ← Recent signals weighted higher
──────────────────────────────────────────────────────────
Total          (0-100)

🔥 HOT   ≥ 70  — Ready for outreach   |  ⭐ WARM  ≥ 40  — Monitor
❄️ COLD  < 40  — Track only
```

**Example:** Bio-Rad Laboratories — 3 recent FDA clearances, strong product overlap → **HOT (89/100)**

Every score is **deterministic and explainable** — no black box, can be tuned by domain experts.

<div class="speaker">🎤 Speaker 1 (Tobias): 45s</div>

---

## ④ Live Demo

<div class="columns">
<div>

**Dashboard**
- Summary cards: 1,300+ companies scored
- Top 5 leads ranked by score
- Quick actions: Seed, Ingest, Score
- Real-time Neo4j health status

**Lead Explorer**
- Filterable, sortable table
- Tier badges (🔥/⭐/❄️)
- Detail drawer: signals timeline, score breakdown, outreach hook

</div>
<div>

**Pipeline CRM**
- 6-stage kanban: New → Contacted → Meeting → Proposal → Closed Won/Lost
- Advance / regress between stages
- Activity timeline with notes

**AI Services**
- Company enrichment (segment, domain)
- Outreach email generation
- Score explanation in plain language

</div>
</div>

<div class="speaker">🎤 Speaker 2 (Reyyan/Beyza): 90s live demo</div>

---

## ⑤ Value Proposition

<div class="columns">
<div>

**Measurable Impact**

| Metric | Before | After |
|--------|--------|-------|
| Leads identified | **0** | **1,300+** |
| Time to score | **Weeks** | **Seconds** |
| Data sources | **0** | **12** |
| Pipeline tracking | **None** | **Full CRM** |
| AI outreach | **Manual** | **Generated** |

</div>
<div>

**For Siemens Healthineers**
- Systematic lead generation **where none existed**
- AI-powered prioritization — HOT leads surfaced automatically
- Pipeline integration — track from lead to customer
- No special training — works in a browser
- **Goes beyond the hackathon**: deployable pilot in 4 weeks

</div>
</div>

<div class="speaker">🎤 Speaker 2 (Reyyan): 45s</div>

---

## ⑥ Responsible & Meaningful AI

<div class="columns">
<div>

**Where AI is used**
| Feature | AI Role |
|---------|---------|
| Enrichment | LLM extracts segment/domain from text |
| Outreach | LLM generates personalized cold emails |
| Explanation | LLM translates score → plain language |

**Scoring is NOT ML** — it's deterministic, explainable, tunable by domain experts.

</div>
<div>

**Responsible by design**
- ✅ Human-in-the-loop: AI suggests → humans decide
- ✅ Explainable scores: every score has a breakdown
- ✅ Optional: core functionality works **without** any AI
- ✅ Transparent: all AI content labeled as generated
- ✅ GDPR: opt-out preference form, no PII in AI pipeline
- ❌ AI does NOT make sales decisions
- ❌ AI does NOT auto-contact leads
- ❌ AI does NOT store data externally

</div>
</div>

<div class="speaker">🎤 Speaker 2 (Zeynep): 45s</div>

---

## ⑦ Competitive Advantage

| Dimension | Traditional Approach | LeadGraph |
|-----------|--------------------|-----------|
| Data sources | Manual search | **12 automated** |
| Scoring | Gut feel | **AI-driven, 4 factors** |
| Coverage | Regional | **Global** |
| Speed | Days/weeks | **Real-time** |
| Pipeline | Spreadsheets | **Integrated CRM** |

**The insight:** FDA filings, clinical trials, and patent data are **leading indicators** of buying intent — weeks before a company starts searching for suppliers. Nobody else connects these dots for B2B lead generation.

<div class="speaker">🎤 Speaker 1 (Tobias): 30s</div>

---

## ⑧ Team & Next Steps

<div class="columns">
<div>

**Team**
| Member | Role | Key Contribution |
|--------|------|------------------|
| 🛠️ **Tobias** | Backend | 12 adapters, Neo4j, scoring engine, API |
| 🎨 **Reyyan** | UI | Lead Explorer, Dashboard, Admin |
| 📋 **Beyza** | Pipeline | Kanban, stage management, activity tracking |
| 🤖 **Zeynep** | AI | Enrichment, outreach, explainer services |

</div>
<div>

**Post-Hackathon Roadmap**
```
Week 1-2    Tune scoring weights with Siemens experts
Week 3-4    Add 5 more sources (D&B, Crunchbase)
Week 5-6    Siemens CRM (Salesforce) integration
Week 7-8    User testing with 3 sales teams
Month 3     Pilot rollout with 10 sales reps
Month 4-6   Full production deployment
```

**Immediate**: Deploy for internal evaluation with 5 sales team members.

</div>
</div>

<div class="speaker">🎤 Both speakers: 30s</div>
