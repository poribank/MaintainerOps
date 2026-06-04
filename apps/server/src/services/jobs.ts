import { Queue, Worker, type Job, type JobsOptions, type QueueOptions, type WorkerOptions } from "bullmq";
import type { AppConfig } from "../config.js";
import type { SecurityScannerRunner, ScannerResult } from "./scanners.js";

export type MaintainerJobType = "scan.scorecard" | "scan.osv";
export type MaintainerJobStatus = "queued" | "active" | "completed" | "failed";

export interface MaintainerJobInput {
  repository?: string;
  path?: string;
}

export interface MaintainerJob {
  id: string;
  type: MaintainerJobType;
  status: MaintainerJobStatus;
  createdAt: string;
  updatedAt: string;
  input: MaintainerJobInput;
  result?: ScannerResult;
  error?: string;
}

export interface JobQueue {
  enqueue(type: MaintainerJobType, input: MaintainerJobInput): Promise<MaintainerJob>;
  get(id: string): Promise<MaintainerJob | undefined>;
  list(limit?: number): Promise<MaintainerJob[]>;
  close(): Promise<void>;
}

export function createJobQueue(config: AppConfig, scanners: SecurityScannerRunner): JobQueue {
  if (config.queue.driver === "bullmq") {
    return new BullMqJobQueue(config, scanners);
  }

  return new MemoryJobQueue(scanners);
}

export class MemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, MaintainerJob>();
  private sequence = 0;

  constructor(private readonly scanners: SecurityScannerRunner) {}

  async enqueue(type: MaintainerJobType, input: MaintainerJobInput): Promise<MaintainerJob> {
    const now = new Date().toISOString();
    const job: MaintainerJob = {
      id: `mem-${++this.sequence}`,
      type,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      input
    };
    this.jobs.set(job.id, job);
    queueMicrotask(() => {
      void this.process(job.id);
    });
    return cloneJob(job);
  }

  async get(id: string): Promise<MaintainerJob | undefined> {
    const job = this.jobs.get(id);
    return job ? cloneJob(job) : undefined;
  }

  async list(limit = 50): Promise<MaintainerJob[]> {
    return Array.from(this.jobs.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map(cloneJob);
  }

  async close(): Promise<void> {
    return undefined;
  }

  private async process(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = "active";
    job.updatedAt = new Date().toISOString();

    try {
      job.result = await runMaintainerJob(this.scanners, job.type, job.input);
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown job error.";
    } finally {
      job.updatedAt = new Date().toISOString();
    }
  }
}

export class BullMqJobQueue implements JobQueue {
  private readonly queue: Queue<MaintainerJobInput, ScannerResult, MaintainerJobType>;
  private readonly worker?: Worker<MaintainerJobInput, ScannerResult, MaintainerJobType>;

  constructor(config: AppConfig, scanners: SecurityScannerRunner) {
    const connection = parseRedisConnection(config.queue.redisUrl);
    const queueOptions: QueueOptions = { connection };
    this.queue = new Queue<MaintainerJobInput, ScannerResult, MaintainerJobType>("maintainerops", queueOptions);

    if (config.queue.inlineWorker) {
      const workerOptions: WorkerOptions = {
        connection,
        concurrency: 2
      };
      this.worker = new Worker<MaintainerJobInput, ScannerResult, MaintainerJobType>(
        "maintainerops",
        async (job) => runMaintainerJob(scanners, job.name, job.data),
        workerOptions
      );
    }
  }

  async enqueue(type: MaintainerJobType, input: MaintainerJobInput): Promise<MaintainerJob> {
    const options: JobsOptions = {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: false,
      removeOnFail: false
    };
    const job = await this.queue.add(type, input, options);
    return mapBullMqJob(job);
  }

  async get(id: string): Promise<MaintainerJob | undefined> {
    const job = await this.queue.getJob(id);
    return job ? mapBullMqJob(job) : undefined;
  }

  async list(limit = 50): Promise<MaintainerJob[]> {
    const jobs = await this.queue.getJobs(["waiting", "active", "completed", "failed", "delayed"], 0, limit - 1, true);
    return Promise.all(jobs.map((job) => mapBullMqJob(job)));
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}

export async function runMaintainerJob(
  scanners: SecurityScannerRunner,
  type: MaintainerJobType,
  input: MaintainerJobInput
): Promise<ScannerResult> {
  switch (type) {
    case "scan.scorecard":
      if (!input.repository) throw new Error("Scorecard job requires repository.");
      return scanners.runScorecard(input.repository);
    case "scan.osv":
      return scanners.runOsvScanner(input.path ?? ".");
  }
}

async function mapBullMqJob(job: Job<MaintainerJobInput, ScannerResult, MaintainerJobType>): Promise<MaintainerJob> {
  const state = await job.getState();
  const createdAt = new Date(job.timestamp).toISOString();
  const updatedAt = new Date(job.finishedOn ?? job.processedOn ?? job.timestamp).toISOString();
  const mapped: MaintainerJob = {
    id: job.id ?? String(job.timestamp),
    type: job.name,
    status: mapBullMqState(state),
    createdAt,
    updatedAt,
    input: job.data
  };
  if (job.returnvalue) mapped.result = job.returnvalue;
  if (job.failedReason) mapped.error = job.failedReason;
  return mapped;
}

function mapBullMqState(state: string): MaintainerJobStatus {
  if (state === "active") return "active";
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  return "queued";
}

function cloneJob(job: MaintainerJob): MaintainerJob {
  const cloned: MaintainerJob = {
    ...job,
    input: { ...job.input }
  };
  if (job.result) cloned.result = { ...job.result };
  if (job.error) cloned.error = job.error;
  return cloned;
}

function parseRedisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  const connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: Record<string, never>;
    maxRetriesPerRequest: null;
  } = {
    host: url.hostname,
    port: Number.parseInt(url.port || "6379", 10),
    maxRetriesPerRequest: null
  };

  if (url.username) connection.username = decodeURIComponent(url.username);
  if (url.password) connection.password = decodeURIComponent(url.password);
  const db = Number.parseInt(url.pathname.replace("/", "") || "0", 10);
  if (Number.isFinite(db) && db > 0) connection.db = db;
  if (url.protocol === "rediss:") connection.tls = {};
  return connection;
}
