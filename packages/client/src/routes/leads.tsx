import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useScores, type ScoredCompany, type TierLevel } from "../lib/graph";
import { useBulkAddToPipeline, useFindContacts } from "../lib/pipeline";

export const Route = createFileRoute("/leads")({
  component: LeadsPage,
});

// ─── Tier config ──────────────────────────────────────────────────────────────

const tierConfig: Record<TierLevel, { color: string; bg: string; border: string }> = {
  HOT:  { color: "#f97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.3)" },
  WARM: { color: "#eab308", bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.3)" },
  COLD: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)" },
};

// ─── Small components ─────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: TierLevel }) {
  const c = tierConfig[tier];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 12,
      color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}`,
      letterSpacing: "0.3px", whiteSpace: "nowrap",
    }}>
      {tier === "HOT" ? "🔥" : tier === "WARM" ? "⭐" : "❄️"} {tier}
    </span>
  );
}

function ScoreBar({ score, tier }: { score: number; tier: TierLevel }) {
  const color = tierConfig[tier].color;
  return (
    <span style={{ fontSize: 11, color, fontWeight: 700 }}>
      {score}
    </span>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ company, onClose }: { company: ScoredCompany; onClose: () => void }) {
  const c = tierConfig[company.tier];
  const bd = company.breakdown;

  const breakdownItems = [
    { label: "Signal Score",   value: bd?.signal ?? 0,     max: 40 },
    { label: "Product Fit",    value: bd?.productFit ?? 0, max: 30 },
    { label: "Segment Bonus",  value: bd?.segment ?? 0,    max: 20 },
    { label: "Recency Bonus",  value: bd?.recency ?? 0,    max: 10 },
  ];

  const sortedSignals = [...(company.signals ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 40, backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
        backgroundColor: "#161b27",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        zIndex: 50, overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          position: "sticky", top: 0, backgroundColor: "#161b27", zIndex: 1,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{company.name}</h2>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                {company.domain ?? "—"} · {company.segment ?? "Unknown"} · {company.region ?? "—"}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)", border: "none", color: "#888",
                cursor: "pointer", borderRadius: 8, width: 32, height: 32,
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <TierBadge tier={company.tier} />
            <ScoreBar score={company.score} tier={company.tier} />
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Score Breakdown */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Score Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {breakdownItems.map(({ label, value, max }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "#888" }}>{label}</span>
                    <span style={{ color: "#ccc", fontWeight: 600 }}>{value} / {max}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div style={{
                      width: `${(value / max) * 100}%`, height: "100%", borderRadius: 3,
                      backgroundColor: c.color, opacity: 0.85,
                    }} />
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: 6, padding: "10px 14px", borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.04)",
                display: "flex", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>Total Score</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{company.score} / 100</span>
              </div>
            </div>
          </section>

          {/* Outreach Hook */}
          {company.outreachHook && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>
                Outreach Hook
              </div>
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                backgroundColor: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                fontSize: 13, color: "#c7d2fe", lineHeight: 1.6,
                fontStyle: "italic",
              }}>
                "{company.outreachHook}"
              </div>
            </section>
          )}

          {/* Signals Timeline */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Signals Timeline ({sortedSignals.length})
            </div>

            {sortedSignals.length === 0 ? (
              <div style={{ fontSize: 13, color: "#777", padding: "12px 0" }}>No signals found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {sortedSignals.map((signal, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, paddingBottom: 16, position: "relative" }}>
                    {/* Timeline line */}
                    {i < sortedSignals.length - 1 && (
                      <div style={{
                        position: "absolute", left: 7, top: 16, bottom: 0, width: 1,
                        backgroundColor: "rgba(255,255,255,0.07)",
                      }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 15, height: 15, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                      backgroundColor: `rgba(99,102,241,${0.4 + signal.confidence * 0.6})`,
                      border: "2px solid rgba(99,102,241,0.4)",
                      zIndex: 1,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>{signal.type}</span>
                        <span style={{ fontSize: 11, color: "#777", flexShrink: 0 }}>
                          {signal.date ? new Date(signal.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#999", margin: "4px 0 0", lineHeight: 1.5 }}>
                        {signal.description}
                      </p>
                      {signal.url && (
                        <a
                          href={signal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#6366f1", textDecoration: "none", marginTop: 4, display: "inline-block" }}
                        >
                          View source →
                        </a>
                      )}
                      {/* Confidence */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "#777" }}>Confidence</span>
                        <div style={{ width: 50, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)" }}>
                          <div style={{ width: `${signal.confidence * 100}%`, height: "100%", borderRadius: 2, backgroundColor: "#6366f1" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "#555" }}>{Math.round(signal.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Applications */}
          {company.applications && company.applications.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>
                Applications
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {company.applications.map((app) => (
                  <span key={app} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#aaa",
                  }}>
                    {app}
                  </span>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ALL_TIERS: TierLevel[] = ["HOT", "WARM", "COLD"];
const SEGMENTS = ["IVD", "CDMO", "Supplier", "Research", "Pharma", "Other"];

export function LeadsPage() {
  const { data: companies = [], isLoading } = useScores();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierLevel | "ALL">("ALL");
  const [segmentFilter, setSegmentFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<ScoredCompany | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  const bulkAddToPipeline = useBulkAddToPipeline();
  const findContacts = useFindContacts();

  const filtered = useMemo(() => {
    return companies
      .filter((c) => {
        if (tierFilter !== "ALL" && c.tier !== tierFilter) return false;
        if (segmentFilter !== "ALL" && c.segment !== segmentFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.domain?.toLowerCase().includes(q) ||
            c.segment?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [companies, search, tierFilter, segmentFilter]);

  const presentSegments = useMemo(() => {
    const set = new Set(companies.map((c) => c.segment).filter(Boolean) as string[]);
    return SEGMENTS.filter((s) => set.has(s));
  }, [companies]);

  const autoAdded = useRef(false);

  useEffect(() => {
    if (autoAdded.current) return;
    const hot = companies.filter(c => c.tier === "HOT");
    if (hot.length === 0) return;
    autoAdded.current = true;
    const toAdd = hot.map(c => ({
      companyName: c.name,
      contactName: c.contacts?.[0]?.name || undefined,
      contactEmail: c.contacts?.[0]?.email || undefined,
      contactRole: c.contacts?.[0]?.role || undefined,
    }));
    bulkAddToPipeline.mutateAsync(toAdd);
  }, [companies, bulkAddToPipeline]);

  const handleFindContacts = async () => {
    const selectedCompanies = companies.filter(c => selectedIds.has(c.id));
    for (const company of selectedCompanies) {
      if (!company.contacts || company.contacts.length === 0) {
        await findContacts.mutateAsync(company.name);
      }
    }
  };

  const handleFindContactsForCompany = async (company: ScoredCompany) => {
    if (!company.contacts || company.contacts.length === 0) {
      await findContacts.mutateAsync(company.name);
    }
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Lead Explorer</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
            {filtered.length} companies · sorted by score
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {/* Find contacts button */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleFindContacts}
              disabled={findContacts.isPending}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid rgba(22, 163, 74, 0.4)",
                backgroundColor: findContacts.isPending ? "rgba(22, 163, 74, 0.08)" : "rgba(22, 163, 74, 0.15)",
                color: findContacts.isPending ? "#6b7280" : "#86efac",
                fontSize: 12, fontWeight: 700,
                cursor: findContacts.isPending ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>🔍</span>
              {findContacts.isPending ? "Finding contacts..." : "Find contacts for selected"}
            </button>
          )}
          {/* Bulk add selected button */}
          {selectedIds.size > 0 && (
            <button
              onClick={async () => {
                const selectedCompanies = companies.filter(c => selectedIds.has(c.id));
                const toAdd = selectedCompanies.map(c => ({
                  companyName: c.name,
                  contactName: c.contacts?.[0]?.name || undefined,
                  contactEmail: c.contacts?.[0]?.email || undefined,
                  contactRole: c.contacts?.[0]?.role || undefined,
                }));
                await bulkAddToPipeline.mutateAsync(toAdd);
                setSelectedIds(new Set());
              }}
              disabled={bulkAddToPipeline.isPending}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid rgba(99, 102, 241, 0.4)",
                backgroundColor: bulkAddToPipeline.isPending ? "rgba(99, 102, 241, 0.08)" : "rgba(99, 102, 241, 0.15)",
                color: bulkAddToPipeline.isPending ? "#6b7280" : "#a5b4fc",
                fontSize: 12, fontWeight: 700,
                cursor: bulkAddToPipeline.isPending ? "not-allowed" : "pointer",
              }}
            >
              {bulkAddToPipeline.isPending ? "Adding..." : `Add ${selectedIds.size} selected to pipeline`}
            </button>
          )}
          {bulkAddToPipeline.isSuccess && (
            <div style={{ fontSize: 11, color: "#86efac", maxWidth: 250 }}>
              ✓ Added to pipeline successfully
            </div>
          )}
          {bulkAddToPipeline.isError && (
            <div style={{ fontSize: 11, color: "#fca5a5", maxWidth: 250 }}>
              ✗ Failed to add: {(bulkAddToPipeline.error as Error)?.message}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px 9px 36px",
              backgroundColor: "#161b27", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#e0e0e0", fontSize: 13,
              outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#444", fontSize: 14 }}>🔍</span>
        </div>

        {/* Tier filter */}
        {(["ALL", ...ALL_TIERS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px solid",
              cursor: "pointer",
              ...(tierFilter === t
                ? t === "ALL"
                  ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }
                  : { backgroundColor: tierConfig[t].bg, color: tierConfig[t].color, borderColor: tierConfig[t].border }
                  : { backgroundColor: "transparent", color: "#888", borderColor: "rgba(255,255,255,0.08)" }
              ),
            }}
          >
            {t === "HOT" ? "🔥 " : t === "WARM" ? "⭐ " : t === "COLD" ? "❄️ " : ""}{t}
          </button>
        ))}

        {/* Segment filter */}
        {presentSegments.length > 0 && (
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 12,
              backgroundColor: "#161b27", border: "1px solid rgba(255,255,255,0.1)",
              color: "#aaa", cursor: "pointer", outline: "none",
            }}
          >
            <option value="ALL">All segments</option>
            {presentSegments.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: "#161b27",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
      }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "40px 200px 180px 140px 75px 50px 140px 1fr",
          padding: "10px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11, fontWeight: 700, color: "#777",
          letterSpacing: "0.6px", textTransform: "uppercase",
          alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && filtered.length > 0 ? filtered.every(c => selectedIds.has(c.id)) : false}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(new Set(filtered.map(c => c.id)));
                } else {
                  setSelectedIds(new Set());
                }
              }}
              style={{ cursor: "pointer", width: 16, height: 16 }}
            />
          </div>
          <span>Company</span>
          <span>Contact</span>
          <span>Role / Email</span>
          <span>Tier</span>
          <span>Score</span>
          <span>Segment</span>
          <span>Signals</span>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div style={{ padding: 24 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ height: 52, borderRadius: 8, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#777", fontSize: 14 }}>
            No leads match your filters.
          </div>
        ) : (
          <>
            {filtered.map((company) => {
              const contacts = company.contacts ?? [];
              return (
                <div key={company.id}>
                  {contacts.length === 0 ? (
                    <div
                      onClick={() => setSelected(company)}
                      onMouseEnter={() => setHoveredCompany(company.id)}
                      onMouseLeave={() => setHoveredCompany(null)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 200px 180px 140px 75px 50px 140px 1fr",
                        padding: "14px 20px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        cursor: "pointer",
                        transition: "background 0.1s",
                        alignItems: "center",
                        backgroundColor: hoveredCompany === company.id ? "rgba(255,255,255,0.03)" : "transparent",
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(company.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIds);
                            if (e.target.checked) {
                              newSelected.add(company.id);
                            } else {
                              newSelected.delete(company.id);
                            }
                            setSelectedIds(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                      </div>

                      {/* Company name */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{company.name}</div>
                        <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{company.domain ?? "—"}</div>
                      </div>

                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           handleFindContactsForCompany(company);
                         }}
                         disabled={findContacts.isPending}
                         style={{
                           padding: "6px 12px",
                           borderRadius: 6,
                           border: "1px solid rgba(22, 163, 74, 0.3)",
                           backgroundColor: findContacts.isPending ? "rgba(22, 163, 74, 0.08)" : "rgba(22, 163, 74, 0.12)",
                           color: findContacts.isPending ? "#6b7280" : "#86efac",
                           fontSize: 11,
                           fontWeight: 600,
                           cursor: findContacts.isPending ? "not-allowed" : "pointer",
                           display: "flex",
                           alignItems: "center",
                           gap: 4,
                           transition: "all 0.2s ease",
                         }}
                       >
                         <span>{findContacts.isPending ? "🔍" : "✨"}</span>
                         {findContacts.isPending ? "Searching..." : "Find contacts"}
                       </button>

                      {/* Empty context */}
                      <span></span>

                      {/* Tier */}
                      <TierBadge tier={company.tier} />

                      {/* Score bar */}
                      <ScoreBar score={company.score} tier={company.tier} />

                      {/* Segment */}
                      <span style={{ fontSize: 12, color: "#888" }}>{company.segment ?? "—"}</span>

                      {/* Signal types */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {[...new Set(company.signals?.map((s) => s.type) ?? [])].slice(0, 3).map((type) => (
                          <span key={type} style={{
                            fontSize: 10, padding: "2px 7px", borderRadius: 10,
                            backgroundColor: "rgba(99,102,241,0.1)",
                            border: "1px solid rgba(99,102,241,0.2)",
                            color: "#818cf8",
                          }}>
                            {type}
                          </span>
                        ))}
                        {(company.signals?.length ?? 0) > 3 && (
                          <span style={{ fontSize: 10, color: "#777" }}>+{company.signals.length - 3}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    contacts.map((contact, ci) => (
                      <div
                        key={`${company.id}-${contact.id}`}
                        onClick={() => setSelected(company)}
                        onMouseEnter={() => setHoveredCompany(company.id)}
                        onMouseLeave={() => setHoveredCompany(null)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "40px 200px 180px 140px 75px 50px 140px 1fr",
                          padding: "14px 20px",
                          cursor: "pointer",
                          transition: "background 0.1s",
                          alignItems: "center",
                          backgroundColor: hoveredCompany === company.id
                            ? "rgba(255,255,255,0.03)"
                            : ci > 0
                            ? "rgba(255,255,255,0.01)"
                            : "transparent",
                        }}
                      >
                        {/* Checkbox - only show on first row */}
                        {ci === 0 ? (
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(company.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedIds);
                                if (e.target.checked) {
                                  newSelected.add(company.id);
                                } else {
                                  newSelected.delete(company.id);
                                }
                                setSelectedIds(newSelected);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", width: "px", justifyContent: "center" }}></div>
                        )}

                        {/* Company name - only show on first row */}
                        {ci === 0 ? (
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{company.name}</div>
                            <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{company.domain ?? "—"}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: "#777", fontStyle: "italic" }}>{company.name}</span>
                        )}

                        {/* Contact name */}
                        <span style={{ fontSize: 12, color: "#ccc", fontWeight: 500 }}>{contact.name}</span>

                        {/* Role / Email */}
                        <div>
                          <div style={{ fontSize: 11, color: "#aaa" }}>{contact.role ?? "—"}</div>
                          <div style={{ fontSize: 10, color: "#777", marginTop: 1 }}>{contact.email ?? "—"}</div>
                        </div>

                        {/* Tier - only show on first row */}
                        <>{ci === 0 ? <TierBadge tier={company.tier} /> : null}</>

                        {/* Score bar - only show on first row */}
                        <>{ci === 0 ? <ScoreBar score={company.score} tier={company.tier} /> : null}</>

                        {/* Segment - only show on first row */}
                        <span style={{ fontSize: 12, color: "#888" }}>
                          {ci === 0 ? (company.segment ?? "—") : ""}
                        </span>

                        {/* Signal types - only show on first row */}
                        <>{ci === 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {[...new Set(company.signals?.map((s) => s.type) ?? [])].slice(0, 3).map((type) => (
                              <span key={type} style={{
                                fontSize: 10, padding: "2px 7px", borderRadius: 10,
                                backgroundColor: "rgba(99,102,241,0.1)",
                                border: "1px solid rgba(99,102,241,0.2)",
                                color: "#818cf8",
                              }}>
                                {type}
                              </span>
                            ))}
                            {(company.signals?.length ?? 0) > 3 && (
                              <span style={{ fontSize: 10, color: "#777" }}>+{company.signals.length - 3}</span>
                            )}
                          </div>
                        ) : null}</>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {selected && <DetailDrawer company={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
