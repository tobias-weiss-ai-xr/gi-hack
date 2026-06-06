// ============================================================
// Pipeline CRM — Kanban Board
// Owner: Beyza (Task 17)
// File: packages/client/src/routes/pipeline.tsx
// ============================================================

import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import {
  usePipelineLeads,
  useAdvanceStage,
  useAddNote,
  useStartPipeline,
  type PipelineLead,
  type PipelineStage,
  type ActivityNote,
} from "../lib/pipeline";

// ── Constants ────────────────────────────────────────────────

const STAGES: PipelineStage[] = [
  "New",
  "Contacted",
  "Meeting",
  "Proposal",
  "Closed Won",
];

const STAGE_META: Record<
  PipelineStage,
  { color: string; bg: string; border: string; dot: string }
> = {
  New:          { color: "text-slate-300",  bg: "bg-slate-800/60",  border: "border-slate-700",  dot: "bg-slate-400"  },
  Contacted:    { color: "text-blue-300",   bg: "bg-blue-950/60",   border: "border-blue-800",   dot: "bg-blue-400"   },
  Meeting:      { color: "text-violet-300", bg: "bg-violet-950/60", border: "border-violet-800", dot: "bg-violet-400" },
  Proposal:     { color: "text-amber-300",  bg: "bg-amber-950/60",  border: "border-amber-800",  dot: "bg-amber-400"  },
  "Closed Won": { color: "text-emerald-300",bg: "bg-emerald-950/60",border: "border-emerald-800",dot: "bg-emerald-400"},
  "Closed Lost":{ color: "text-rose-300",   bg: "bg-rose-950/60",   border: "border-rose-800",   dot: "bg-rose-400"   },
};

const TIER_BADGE: Record<string, string> = {
  HOT:  "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  WARM: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  COLD: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
};

const NOTE_TYPE_ICON: Record<ActivityNote["type"], string> = {
  NOTE:         "💬",
  EMAIL:        "📧",
  CALL:         "📞",
  MEETING:      "🤝",
  STAGE_CHANGE: "➡️",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Lead Card ────────────────────────────────────────────────

function LeadCard({
  lead,
  onDragStart,
  onClick,
}: {
  lead: PipelineLead;
  onDragStart: (e: React.DragEvent, lead: PipelineLead) => void;
  onClick: (lead: PipelineLead) => void;
}) {
  const meta = STAGE_META[lead.stage];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead)}
      className="group cursor-grab active:cursor-grabbing rounded-xl border border-white/8 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/8 hover:border-white/15 transition-all duration-200 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Company + Tier */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
          <span className="text-xs font-semibold text-white/50 truncate uppercase tracking-wider">
            {lead.companyName}
          </span>
        </div>
        {lead.companyTier && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${TIER_BADGE[lead.companyTier]}`}>
            {lead.companyTier === "HOT" ? "🔥" : lead.companyTier === "WARM" ? "⭐" : "❄️"} {lead.companyTier}
          </span>
        )}
      </div>

      {/* Contact name */}
      <p className="text-sm font-semibold text-white/90 mb-1 group-hover:text-white transition-colors">
        {lead.contactName}
      </p>

      {/* Role */}
      {lead.role && (
        <p className="text-xs text-white/40 mb-3">{lead.role}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30">
          {formatDate(lead.stageEnteredAt)}
        </span>
        {lead.notes.length > 0 && (
          <span className="text-[10px] text-white/30 flex items-center gap-1">
            💬 {lead.notes.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────

function KanbanColumn({
  stage,
  leads,
  onDragStart,
  onDrop,
  onDragOver,
  onDragLeave,
  isDragOver,
  onCardClick,
}: {
  stage: PipelineStage;
  leads: PipelineLead[];
  onDragStart: (e: React.DragEvent, lead: PipelineLead) => void;
  onDrop: (e: React.DragEvent, stage: PipelineStage) => void;
  onDragOver: (e: React.DragEvent, stage: PipelineStage) => void;
  onDragLeave: () => void;
  isDragOver: boolean;
  onCardClick: (lead: PipelineLead) => void;
}) {
  const meta = STAGE_META[stage];

  return (
    <div
      className={`flex flex-col rounded-2xl border transition-all duration-200 min-h-[500px] ${
        isDragOver
          ? "border-white/30 bg-white/8 scale-[1.01]"
          : `${meta.border} ${meta.bg}`
      }`}
      onDragOver={(e) => onDragOver(e, stage)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage)}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${meta.color}`}>
            {stage}
          </span>
        </div>
        <span className="text-xs font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        {leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-white/20 text-center">
              Drop a lead here
            </p>
          </div>
        )}
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onDragStart={onDragStart}
            onClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}

// ── Note Modal ────────────────────────────────────────────────

function NoteModal({
  lead,
  onClose,
}: {
  lead: PipelineLead;
  onClose: () => void;
}) {
  const addNote = useAddNote();
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<ActivityNote["type"]>("NOTE");

  const handleSubmit = async () => {
  if (!note.trim()) return;

  // If lead.id is an array take the first element, otherwise cast to string
  const safeContactId = Array.isArray(lead.id) ? lead.id[0] : String(lead.id);

  await addNote.mutateAsync({ 
    contactId: safeContactId, // ← Artık kesinlikle sadece string
    note: note.trim(), 
    type: noteType 
  });
  
  setNote("");
};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-sm font-bold text-white">{lead.contactName}</h2>
            <p className="text-xs text-white/40">{lead.companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Activity history */}
        <div className="px-6 py-4 max-h-64 overflow-y-auto space-y-2">
          {lead.notes.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-4">No activity yet</p>
          ) : (
            [...lead.notes]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((n) => (
                <div key={n.id} className="flex gap-3 text-xs">
                  <span className="flex-shrink-0 w-5 text-center">{NOTE_TYPE_ICON[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 break-words">{n.note}</p>
                    <p className="text-white/30 mt-0.5">{formatDate(n.date)}</p>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Add note form */}
        <div className="px-6 py-4 border-t border-white/8 space-y-3">
          {/* Note type tabs */}
          <div className="flex gap-1">
            {(["NOTE", "EMAIL", "CALL", "MEETING"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setNoteType(t)}
                className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-all ${
                  noteType === t
                    ? "bg-white/15 text-white"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                {NOTE_TYPE_ICON[t]} {t}
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!note.trim() || addNote.isPending}
              className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all disabled:opacity-40"
            >
              {addNote.isPending ? "Saving..." : "Save note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Lead Modal ────────────────────────────────────────────

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const startPipeline = useStartPipeline();
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    role: "",
  });

  const handleSubmit = async () => {
    if (!form.companyName || !form.contactName) return;
    await startPipeline.mutateAsync({
      companyName: form.companyName,
      contactName: form.contactName,
      email: form.email || undefined,
      role: form.role || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">Add Lead to Pipeline</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { key: "companyName", label: "Company Name *", placeholder: "ASKA Biotech" },
            { key: "contactName", label: "Contact Name *", placeholder: "Dr. Anna Müller" },
            { key: "email",       label: "Email",          placeholder: "a.mueller@aska.de" },
            { key: "role",        label: "Role",           placeholder: "Head of R&D" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wider block mb-1">
                {label}
              </label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-white/40 hover:text-white/70 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.companyName || !form.contactName || startPipeline.isPending}
            className="px-5 py-2 text-xs font-bold bg-white text-black rounded-lg hover:bg-white/90 transition-all disabled:opacity-40"
          >
            {startPipeline.isPending ? "Adding..." : "Add to Pipeline"}
          </button>
        </div>

        {startPipeline.isError && (
          <p className="px-6 pb-4 text-xs text-rose-400">
            {(startPipeline.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Pipeline Page ────────────────────────────────────────

export function PipelinePage() {
  const { data: leads = [], isLoading, isError } = usePipelineLeads();
  const advanceStage = useAdvanceStage();

  const [draggedLead, setDraggedLead] = useState<PipelineLead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Group leads by stage
  const byStage = STAGES.reduce<Record<PipelineStage, PipelineLead[]>>(
    (acc, stage) => {
      acc[stage] = leads.filter((l) => l.stage === stage);
      return acc;
    },
    {} as Record<PipelineStage, PipelineLead[]>
  );

  // ── Drag handlers ─────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, lead: PipelineLead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedLead || draggedLead.stage === targetStage) return;
    advanceStage.mutate({ contactId: draggedLead.id, targetStage });
    setDraggedLead(null);
  };

  // ── Render ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080b12] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-white/30">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[#080b12] flex items-center justify-center">
        <p className="text-sm text-rose-400">Failed to load pipeline. Is Neo4j running?</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-white font-['DM_Sans',sans-serif]">
      {/* Background texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(139,92,246,0.08) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(59,130,246,0.06) 0%, transparent 50%)`,
        }}
      />

      <div className="relative z-10 px-6 py-8 max-w-[1600px] mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-black tracking-tight text-white"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Sales Pipeline
            </h1>
            <p className="text-sm text-white/40 mt-1">
              {leads.length} lead{leads.length !== 1 ? "s" : ""} in pipeline
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg"
          >
            <span className="text-base leading-none">+</span>
            Add Lead
          </button>
        </div>

        {/* ── Stage summary strip ── */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
          {STAGES.map((stage) => {
            const meta = STAGE_META[stage];
            const count = byStage[stage]?.length ?? 0;
            return (
              <div
                key={stage}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${meta.border} ${meta.bg}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                <span className={`font-semibold ${meta.color}`}>{stage}</span>
                <span className="text-white/30 font-mono">{count}</span>
              </div>
            );
          })}
        </div>

        {/* ── Kanban board ── */}
        <div className="grid grid-cols-5 gap-4">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={byStage[stage] ?? []}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              isDragOver={dragOverStage === stage}
              onCardClick={setSelectedLead}
            />
          ))}
        </div>
      </div>

      {/* ── Note modal ── */}
      {selectedLead && (
        <NoteModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}

      {/* ── Add lead modal ── */}
      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
