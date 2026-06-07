# Ontology Improvement Tasks

Based on graph database ontology design literature review and comparison against the current LeadGraph ontology at `packages/server/src/services/graph/ingest/ontology.ts`.

## Priority: High

- [ ] **Promote Region from property to node**
  - `Company.region` is currently a string property (`EUROPE`, `NORTH_AMERICA`, `ASIA`)
  - Create `(:Region {name})` nodes with `(:Company)-[:OPERATES_IN]->(:Region)`
  - Enables `MATCH (c:Company)-[:OPERATES_IN]->(:Region {name:"EUROPE"})` without property scan
  - Reference: Neo4j modeling-designs — under-normalization antipattern

- [ ] **Promote Segment from property to node**
  - `Company.segment` is currently a string property (`IVD_MANUFACTURER`, `SUPPLIER`, `CDMO`)
  - Create `(:Segment {name})` nodes with `(:Company)-[:IN_SEGMENT]->(:Segment)`
  - Same reasoning as Region — enables direct traversal queries

- [ ] **Enforce Signal type schema in Neo4j**
  - Currently only an INDEX on `Signal.type`; 12 possible types defined in TypeScript
  - Create `(:SignalType {name})` nodes and ensure `HAS_SIGNAL` relationships only connect to valid types
  - Prevents silent ingestion of novel signal types by adapters
  - Reference: GraphAcademy data-modeling-core-principles

- [ ] **Add cross-signal correlation relationships**
  - Signals from different sources about the same development are currently disconnected
  - Add `(:Signal)-[:CORRELATED_WITH]->(:Signal)` or `(:Signal)-[:FOLLOWS_UP]->(:Signal)`
  - Enables compound event detection in Cypher (e.g., "Patent + Hiring within 3 months")
  - Reference: Mungall biological KG modeling design patterns

## Priority: Medium

- [ ] **Add competitive relationships between companies**
  - No way to express `(:Company)-[:COMPETES_WITH]->(:Company)` or `(:Company)-[:CUSTOMER_OF]->(:Company)`
  Companies are islands connected only through shared Application areas
  - Enables "which companies compete with Euroimmun in autoimmune diagnostics?" as a single Cypher query
  - Reference: GraphBRAIN paper (Ferilli 2022) — ontology as schema on LPGs

- [ ] **Make Application areas hierarchical**
  - 13 flat strings currently; medical diagnostics has clear taxonomies
  - Convert to `(:ApplicationArea {name})` with `(:PARENT_OF*0..)` relationships
  - Enables query at multiple granularity levels
  - Reference: Noy & McGuinness Ontology Development 101 — competency questions

- [ ] **Fix seed function to use MERGE for signals**
  - `seedGraph()` uses `CREATE (s:Signal {...})` — signals get duplicated on re-seed
  - Change to `MERGE` with appropriate unique key (sourceId + type + date)
  - Also ensure adapter layer uses MERGE for signals from external sources
  - Reference: Neo4j data-modeling-best-practices idempotency guideline

- [ ] **Add ontology versioning**
  - `seedGraph()` has no version marker; no drift detection as ontology evolves
  - Add `(:OntologyVersion {version, schemaHash, deployedAt})` node
  - Enables auto-migration on schema changes
  - Reference: Neo4j modelling-designs — intermediate nodes for temporal state

## Priority: Low

- [ ] **Store score components in the graph**
  - Scoring pipeline (SignalScore + ProductFit + SegmentBonus + RecencyBonus → Tier) runs in TypeScript
  - Currently every request recomputes scores; graph doesn't know which companies are HOT
  - Store `SignalScore`, `ProductFitScore`, `SegmentBonus`, `RecencyBonus`, `Total`, `Tier` as properties on Company
  - Trade-off: scores become stale until recalculation (manageable if recalculated on each ingestion)
  - Enables: `MATCH (c:Company {tier:"HOT"})-[:OPERATES_IN]->(:Region {name:"EUROPE"})`

- [ ] **Evaluate neosemantics for medical vocabulary mapping**
  - Currently a pure property graph; no RDF/OWL semantics
  - If interoperability with SNOMED CT, LOINC, ICD-10 becomes a requirement
  - Neosemantics enables OWL import/export without leaving the property graph model
  - Reference: Gainey ontologies in Neo4j blog, Howard RDF vs PG comparison
  - **Do not do this pre-emptively** — only if medical vocabulary integration is explicitly needed
