import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface ConferenceRecord {
  companyName: string;
  domain: string;
  description: string;
  applicationAreas: string[];
  eventName: string;
  eventDate: string;
  boothOrSession: string;
}

const CONFERENCES: ConferenceRecord[] = [
  {
    companyName: "SERION Immunologics GmbH",
    domain: "serion-immunologics.de",
    description: "German serology diagnostics — presenting new ELISA portfolio",
    applicationAreas: ["Infectious Disease & Serology", "Autoimmune Diagnostics"],
    eventName: "MEDICA 2025",
    eventDate: "2025-11-18",
    boothOrSession: "Hall 3, Booth E40",
  },
  {
    companyName: "DIARECT AG",
    domain: "diarect.com",
    description: "German autoimmune diagnostics — novel autoimmune panel presentation",
    applicationAreas: ["Autoimmune Diagnostics", "Infectious Disease & Serology"],
    eventName: "ADLM 2025 (Clinical Lab Expo)",
    eventDate: "2025-10-15",
    boothOrSession: "Session: Innovation in Autoimmune Diagnostics",
  },
  {
    companyName: "IBL International GmbH",
    domain: "ibl-international.com",
    description: "German immunodiagnostics — autoimmune and infectious disease portfolio",
    applicationAreas: ["Autoimmune Diagnostics", "Infectious Disease & Serology"],
    eventName: "MEDICA 2025",
    eventDate: "2025-11-18",
    boothOrSession: "Hall 3, Booth F22",
  },
  {
    companyName: "Euroimmun AG",
    domain: "euroimmun.com",
    description: "Autoimmune and infectious disease diagnostics leader",
    applicationAreas: ["Autoimmune Diagnostics", "Infectious Disease & Serology", "Cardiac Markers"],
    eventName: "MEDICA 2025",
    eventDate: "2025-11-18",
    boothOrSession: "Hall 3, Booth A12",
  },
  {
    companyName: "Bio-Rad Laboratories",
    domain: "bio-rad.com",
    description: "Global diagnostics and life sciences company",
    applicationAreas: ["Infectious Disease & Serology", "Cardiac Markers", "Oncology & Tumor Markers"],
    eventName: "ADLM 2025",
    eventDate: "2025-10-14",
    boothOrSession: "Main Exhibit Hall, Booth 1200",
  },
];

export class ConferenceStubAdapter implements SourceAdapter {
  readonly id = "conference";
  readonly name = "Conference Exhibitors (Stub)";
  readonly description = "Simulated trade show exhibitor data from MEDICA and ADLM";

  async fetch(): Promise<RawLead[]> {
    return CONFERENCES.map((c, i) => ({
      sourceId: `conf-${i + 1}`,
      sourceUrl: `https://example.com/events/${c.eventName.toLowerCase().replace(/[^a-z]/g, "-")}`,
      raw: c as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawLead): LeadCandidate {
    const c = raw.raw as unknown as ConferenceRecord;
    const signals: Signal[] = [
      {
        type: "CONFERENCE",
        date: c.eventDate,
        confidence: 0.6,
        description: `Exhibitor at ${c.eventName} — ${c.boothOrSession}`,
        url: raw.sourceUrl,
      },
    ];
    return {
      sourceId: raw.sourceId,
      companyName: c.companyName,
      domain: c.domain,
      description: c.description,
      applicationAreas: c.applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
