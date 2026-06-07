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
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  .highlight { color: #f97316; font-weight: 700; }
  .accent { color: #818cf8; font-weight: 600; }
  .success { color: #86efac; font-weight: 600; }
  .point { color: #fbbf24; }
  table { font-size: 0.75rem; margin: 0 auto; }
  th { color: #a5b4fc; background: rgba(99,102,241,0.1); }
  td { background: rgba(255,255,255,0.03); }
  blockquote { border-left: 4px solid #6366f1; background: rgba(99,102,241,0.08); padding: 0.5rem 1rem; }
  footer { font-size: 0.5rem; color: #555; }
---

# LeadGraph

**AI-powered B2B Lead Identification**

Siemens Healthineers — StartMiUp Hackathon 2026

![bg right:40%](teaser.png)

---

## 01. Hook

**Potential clients face the problem. Competitive products. Market intelligence gap.**

---

## 02. Problem Understanding & Fit

**How to discover assay (convert) leads globally and good in an efficient way?**

---

### The Real Problem

<div class="columns">
<div>

**Company Reality**
- Siemens Healthineers produces **biological intermediates** at Marburg
  - Proteins, antibodies, latex particles, blockers
- **No B2B sales structure** to identify buyers
- Customers are **diagnostic companies** developing new assays
- They don't know **who** is developing **what** — or **when** they need supplies

</div>
<div>

**Challenge Fit ✓**
- B2B lead identification for a **niche industrial supplier**
- Data lives across **12+ public sources** (FDA, patents, clinical trials, research)
- Need to **connect dots** between signals and buying intent
- AI approach is **essential** — no manual solution scales to thousands of companies

</div>
</div>

---

### Why It Matters

> A new FDA clearance for a diagnostic assay means that company **will need biological intermediates** within 6–12 months. Today, Siemens has no way to know this.

- Medical diagnostics market: **$75B+** growing at 6% annually
- Each new assay represents **$50K–500K** in annual intermediate revenue
- **Thousands** of companies developing assays worldwide
- Currently **zero systematic lead generation** in place

---

## 03. Solution in One Sentence

**Sales data funnel with 3 phases: Discover → Qualify → Convert**

---

### The LeadGraph Solution

We help **Siemens Healthineers** **identify and prioritize B2B leads** by **automatically scanning 12+ public data sources for signals of buying intent**.

```
┌─────────────────┐
│    Discover     │
│  12+ Data       │
│  Sources        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Qualify      │
│  AI Scoring     │
│  Hot/Warm/Cold  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Convert      │
│  Pipeline CRM   │
│  Outreach       │
└─────────────────┘
```

---

## 04. Demo / Prototype

🔗 **github.com/tobias-weiss-ai/gi-hack**

---

### Live Demo — Show It, Don't Describe It

## **LeadGraph at leads.graphwiz.ai**

---

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    LeadGraph Platform                      │
├──────────┬───────────────┬──────────────┬────────────────┤
│ Dashboard│  Lead Explorer │ Pipeline CRM │  AI Services   │
│  (React) │   (React)      │   (React)    │    (Express)    │
├──────────┴───────────────┴──────────────┴────────────────┤
│                  Express API Gateway                      │
├──────────────────────────────────────────────────────────┤
│                      Neo4j Graph DB                       │
├──────────┬───────────────┬──────────────┬────────────────┤
│   FDA    │  ClinicalTrials│   Patents   │  Research      │
│  510(k)  │   .gov         │   (EPO OPS) │  (OpenAlex)    │
├──────────┼───────────────┼──────────────┼────────────────┤
│  GitHub  │   MEDICA      │   BMBF       │  DRKS (DE)    │
│          │   Scrape      │   FÖKAT     │  Clinical      │
└──────────┴───────────────┴──────────────┴────────────────┘
```

---

### Working Prototype — What You'll See

| Feature | Status | What It Does |
|---------|--------|--------------|
| **Data Ingestion** | ✅ | 12 adapters — FDA, ClinicalTrials, Patents, Research, GitHub, more |
| **Scoring Engine** | ✅ | 4-factor scoring: Signal + Product Fit + Segment + Recency |
| **Lead Explorer** | ✅ | Filterable, sortable table with tier badges, detail drawer |
| **Pipeline CRM** | ✅ | Kanban board with stage advancement, activity tracking |
| **AI Enrichment** | ✅ | Automatic company enrichment (segment, domain, outreach) |
| **AI Outreach** | ✅ | Generate personalized sales emails via LLM |
| **Dashboard** | ✅ | Summary cards, top leads, real-time Neo4j health |

---

### How It Works — Data → Score → Act

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   FDA    │    │ Clinical │    │  Patents │    │ Research │
│ 510(k)   │    │  Trials  │    │          │    │          │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     └───────────────┴───────────────┴───────────────┘
                               │
                     ┌─────────▼─────────┐
                     │   Neo4j Graph      │
                     │  Knowledge Graph   │
                     └─────────┬─────────┘
                               │
                     ┌─────────▼─────────┐
                     │   Scoring Engine   │
                     │  HOT ≥ 70 / WARM ≥ │
                     │  40 / COLD < 40   │
                     └─────────┬─────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
          ┌────▼───┐    ┌─────▼────┐    ┌─────▼───┐
          │ Lead   │    │ Pipeline │    │   AI    │
          │Explorer│    │   CRM    │    │Outreach │
          └────────┘    └──────────┘    └─────────┘
```

---

### Scoring Algorithm

```
Signal Score   (0-40)  ← FDA clearances, patents, trials, funding
Product Fit    (0-30)  ← How closely their work matches our products
Segment Bonus  (0-20)  ← Industry segment relevance
Recency Bonus  (0-10)  ← Recent signals weighted higher
──────────────────────────────────────────────────
Total          (0-100)

🔥 HOT   ≥ 70  — Ready for outreach
⭐ WARM  ≥ 40  — Promising, monitor
❄️ COLD  < 40  — Track but no action
```

---

## 05. Responsible Use of AI

**Say it out loud: where AI does the work, why there, and how you keep it trustworthy.**

---

### DSGVO-Compliant & Secure

```
┌─────────────────┐     ┌─────────────────┐
│   LCM + Graph   │     │  Private +      │
│   Private       │     │  Secure = Win   │
│   Secure        │     │                 │
└─────────────────┘     └─────────────────┘
```

- **Self-hosted server** — DSGVO compliant
- **Webservers hosted in EU** — Data never leaves the EU
- **CI Pipeline, Railguards, Testing** — Quality and security built in
- **No AI Black Box** — Explainable scoring algorithm

---

### Where AI Is Used — And Why

| Feature | AI Role | Why AI? |
|---------|---------|---------|
| **Lead Scoring** | Algorithmic (not ML) | Deterministic, explainable, tunable by domain experts |
| **Company Enrichment** | LLM extracts segment, domain, product fit from free text | Unstructured data → structured signal |
| **Outreach Email** | LLM generates personalized first-contact email | Template doesn't work for B2B biotech |
| **Score Explanation** | LLM translates numerical score → natural language | Humans need to understand *why* |

---

### Responsible AI Principles

- **Human-in-the-loop**: AI suggests → humans decide
- **Explainable scores**: Every score has a breakdown — no black boxes
- **Optional AI**: Core functionality works **without** any AI
- **No fake confidence**: AI clearly marks generated content
- **Data privacy**: No customer data sent to AI providers without explicit action
- **Transparency**: All AI-generated content is labeled as such

---

### What AI Does NOT Do

- ❌ Make final sales decisions
- ❌ Automatically contact leads without approval
- ❌ Store proprietary Siemens data in external systems
- ❌ Replace human sales expertise
- ❌ Generate fake leads or hallucinate companies

---

## 06. Business & User Value

**Focus on Sales calls! Not on scraping the internet! Fast reaction to patents/research.**

---

### What Changes for the Company

<div class="columns">
<div>

**For Sales Teams**
- **Focus on Sales calls!** — Not on scraping the internet
- **Fast reaction to patents/research** — Be there before competitors
- **Systematic lead generation** where none existed before
- From **zero visibility** to **1,300+ scored companies**
- **AI-powered prioritization** — HOT leads surfaced automatically

</div>
<div>

**Measurable Impact**
| Metric | Before | After |
|--------|--------|-------|
| Leads identified | 0 | 1,300+ |
| Time to score | Weeks | Seconds |
| Data sources | 0 | 12 |
| Pipeline tracking | None | Full CRM |
| AI outreach | Manual | Generated |

</div>
</div>

---

### Day-to-Day Reality Fit

- **Sales teams** get a prioritized list of HOT leads immediately
- **Marketing** can segment by product fit and industry
- **Management** gets visibility into pipeline progression
- **No special training** — works via web browser
- **Live data** — scores update automatically as new signals appear

---

### Competitive Advantage

> "While competitors are still doing manual LinkedIn prospecting, Siemens Healthineers can **surface and qualify** leads from FDA filings, clinical trials, and patent data — automatically."

| Differentiation | Our Solution | Traditional |
|----------------|-------------|-------------|
| Data sources | 12+ automated | Manual search |
| Scoring | AI-driven, 4 factors | Gut feel |
| Coverage | Global | Regional |
| Speed | Real-time | Days/weeks |
| Pipeline | Integrated CRM | Spreadsheets |

---

## 07. Feasibility & Next Steps

**What would it take to build this for real?**

---

### Technical Feasibility

- **Architecture**: Modular, production-ready stack (React + Express + Neo4j)
- **Dockerized**: One command to deploy
- **API-first**: All functionality accessible via REST API
- **All 12 data adapters working** with real external APIs
- **Scoring engine** is deterministic, explainable, and tunable

### Constraints Addressed

| Concern | How We Handle It |
|---------|-----------------|
| Data freshness | Scheduled re-ingestion, 30s auto-refresh |
| API rate limits | Graceful degradation, cached results |
| Neo4j scalability | Indexed queries, batch operations |
| AI costs | Optional — works without OpenAI key |
| GDPR | No PII stored, opt-out preference form |

### Next Steps — Post-Hackathon

- **LinkedIn MCP** — Expand data sources
- **API Access further sources** — D&B, Crunchbase, industry reports
- **Workflow fitting** (hypothetical) — Integrate with existing Siemens CRM system
- **User testing** (hypothetical) — Validate with Siemens sales teams → iterate
- **Pilot rollout** (hypothetical) — Full production deployment if successful

---

## 08. Close

**Business and Success. Sustainability.**

---

### Call Back to Hook

**Potential clients face the problem. Competitive products. Market intelligence gap.**

LeadGraph solves this gap by turning regulatory signals into sales opportunities — fast, systematic, and scalable.

---

### Final Message

**"We help Siemens Healthineers — and any industrial supplier — find the companies that need their products, before competitors do."**

---

### Thank You

**LeadGraph — AI-powered B2B Lead Identification**

📧 StartMiUp Hackathon — June 2026
🔗 [github.com/tobias-weiss-ai/gi-hack](https://github.com/tobias-weiss-ai/gi-hack)

---

### Team

| Member | Role | Key Contributions |
|--------|------|-------------------|
| 🛠️ **Tobias** | Backend Pipeline | 12 data adapters, Neo4j model, scoring engine, API |
| 🎨 **Reyyan** | Dashboard UI | Lead Explorer, Admin, Navigation, TanStack integration |
| 📋 **Beyza** | Pipeline CRM | Kanban board, stage management, activity tracking |
| 🤖 **Zeynep** | AI Layer | Company enrichment, outreach generation, score explanation |

---

### Appendix: Technical Deep Dive

<small>

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 19 + Vite + TanStack Router | SPA with routing, data fetching, state management |
| Backend | Express + TypeScript | REST API gateway, business logic |
| Graph DB | Neo4j 5 + APOC | Knowledge graph storage, relationship queries |
| AI SDK | Vercel AI SDK (OpenAI) | LLM integration for enrichment, outreach, explain |
| Styling | Tailwind v4 + Inline styles | Dark UI with 0.5s page load |
| Build | TypeScript + Vite | Type-safe across client/server/shared |

</small>

---

### Appendix: Data Sources — 12 Adapters

<small>

| Source | Type | Signal | Auth |
|--------|------|--------|------|
| FDA 510(k) | Real API | FDA_CLEARANCE | None |
| GitHub | Real API | GITHUB_ACTIVITY | Token (opt) |
| ClinicalTrials.gov | Real API | CLINICAL_TRIAL | None |
| OpenAlex | Real API | RESEARCH_PUBLICATION | None |
| DRKS (DE) | Real API | CLINICAL_TRIAL | None |
| EPO OPS (EP) | Real API | PATENT | OAuth2 (free reg.) |
| MEDICA (DE) | Scrape | CONFERENCE | None |
| BMBF FÖKAT (DE) | CSV | FUNDING | None |
| 4 stubs | Simulated | Various | None |

</small>

---

### Appendix: Score Breakdown Example

```
Company: Bio-Rad Laboratories
Tier: 🔥 HOT (Score: 89/100)

Signal Score:      35/40  ← 3 FDA clearances, 2 clinical trials
Product Fit:       26/30  ← Strong overlap with protein products
Segment Bonus:     18/20  ← In-vitro diagnostics segment
Recency Bonus:     10/10  ← All signals from last 6 months

Why HOT: "Bio-Rad has 3 recent FDA clearances for new
diagnostic assays that likely require biological intermediates.
Their product portfolio closely matches Siemens' offerings."
```

---

### Appendix: Pipeline CRM Stages

```
Discovery → Qualification → Proposal → Negotiation → Closed Won
    ↓             ↓             ↓           ↓
   HOT       Contact made   Quote sent   Agreement
   lead      needs          delivered    signed
   identified   confirmed
```
