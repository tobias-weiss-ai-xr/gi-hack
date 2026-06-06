import { IngestionSummary } from "./types.js";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface IngestJob {
  id: string;
  status: JobStatus;
  totalAdapters: number;
  completedAdapters: number;
  currentAdapter?: string;
  results: IngestionSummary[];
  errors: string[];
  createdAt: Date;
  completedAt?: Date;
}

let jobCounter = 0;
const jobs = new Map<string, IngestJob>();

function generateId(): string {
  jobCounter++;
  const ts = Date.now().toString(36);
  return `ingest-${ts}-${jobCounter}`;
}

export function createJob(totalAdapters: number): string {
  const id = generateId();
  jobs.set(id, {
    id,
    status: "pending",
    totalAdapters,
    completedAdapters: 0,
    results: [],
    errors: [],
    createdAt: new Date(),
  });
  return id;
}

export function startJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (job) job.status = "running";
}

export function completeAdapter(jobId: string, summary: IngestionSummary): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.completedAdapters++;
  job.currentAdapter = summary.sourceId;
  job.results.push(summary);
}

export function completeJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "completed";
  job.completedAt = new Date();
  job.currentAdapter = undefined;
}

export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "failed";
  job.completedAt = new Date();
  job.errors.push(error);
}

export function getJob(jobId: string): IngestJob | undefined {
  return jobs.get(jobId);
}

/** Keep jobs around for up to 100 entries to avoid memory leak */
export function cleanupOldJobs(maxJobs = 100): void {
  if (jobs.size <= maxJobs) return;
  const sorted = Array.from(jobs.entries())
    .sort(([, a], [, b]) => b.createdAt.getTime() - a.createdAt.getTime());
  const toDelete = sorted.slice(maxJobs);
  for (const [id] of toDelete) jobs.delete(id);
}
