// BullMQ-backed job queue scaffold.
// Implements the same interface as JobQueue but delegates to BullMQ.
// Does NOT require Redis to be running — this is a code scaffold only.
//
// To activate:
//   1. npm install bullmq
//   2. Set REDIS_URL environment variable
//   3. Swap BullMQJobQueue for JobQueue in the orchestrator CLI

import { v4 as uuid } from 'uuid';
import { JobResult, JobStatus, JOB_CONFIGS } from './job-types';
import { JobEventListener, JobEvent, JobExecutor, CircuitBreaker } from './job-queue';

// ─── Redis connection config ────────────────────────────────────────

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

// ─── BullMQ Queue implementation ────────────────────────────────────

const QUEUE_NAME = 'signalforge-jobs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BullMQModule = any;

export class BullMQJobQueue {
  private bullmq: BullMQModule = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _queue: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _worker: any = null;
  private results: Map<string, JobResult> = new Map();
  private pendingResolvers: Map<string, (result: JobResult) => void> = new Map();
  private executors: Map<string, { type: string; input: unknown; executor: JobExecutor<unknown, unknown> }> = new Map();
  private listeners: JobEventListener[] = [];
  readonly circuitBreaker: CircuitBreaker = new CircuitBreaker();
  private _initialized = false;

  onJobEvent(listener: JobEventListener): void {
    this.listeners.push(listener);
  }

  private emit(event: JobEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // Initialize BullMQ queue and worker. Call once before using.
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Dynamic require to avoid compile-time dependency
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.bullmq = require('bullmq');
    } catch {
      throw new Error(
        'bullmq is not installed. Run: npm install bullmq'
      );
    }

    const redis = getRedisConfig();

    this._queue = new this.bullmq.Queue(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._worker = new this.bullmq.Worker(
      QUEUE_NAME,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (job: any) => {
        const { jobId, type, input } = job.data;
        const entry = this.executors.get(jobId);
        if (!entry) throw new Error(`No executor registered for job ${jobId}`);

        this.emit({ type: 'job:start', jobId, jobType: type });

        return entry.executor(input);
      },
      { connection: redis, concurrency: 5 },
    );

    // Wire up completion events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._worker.on('completed', (job: any, returnvalue: any) => {
      const { jobId, type } = job.data;

      const result: JobResult = {
        jobId,
        jobType: type,
        status: 'completed',
        output: returnvalue,
        startedAt: new Date(job.processedOn ?? Date.now()).toISOString(),
        completedAt: new Date(job.finishedOn ?? Date.now()).toISOString(),
        durationMs: (job.finishedOn ?? Date.now()) - (job.processedOn ?? Date.now()),
        attempts: job.attemptsMade,
      };

      this.results.set(jobId, result);
      this.circuitBreaker.recordSuccess(type);
      this.emit({ type: 'job:complete', jobId, jobType: type, result });
      this.pendingResolvers.get(jobId)?.(result);
      this.pendingResolvers.delete(jobId);
      this.executors.delete(jobId);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._worker.on('failed', (job: any, err: Error) => {
      const { jobId, type } = job.data;

      const result: JobResult = {
        jobId,
        jobType: type,
        status: 'failed',
        error: err?.message ?? 'Unknown error',
        startedAt: new Date(job.processedOn ?? Date.now()).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - (job.processedOn ?? Date.now()),
        attempts: job.attemptsMade,
      };

      this.results.set(jobId, result);
      this.circuitBreaker.recordFailure(type);
      this.emit({ type: 'job:fail', jobId, jobType: type, result, error: err?.message });
      this.pendingResolvers.get(jobId)?.(result);
      this.pendingResolvers.delete(jobId);
      this.executors.delete(jobId);
    });

    this._initialized = true;
  }

  // Enqueue a job and return its ID
  enqueue<TInput, TOutput>(
    type: string,
    input: TInput,
    executor: JobExecutor<TInput, TOutput>,
  ): string {
    const id = uuid();
    this.executors.set(id, { type, input, executor: executor as JobExecutor<unknown, unknown> });
    return id;
  }

  // Execute a single job by adding it to the BullMQ queue
  async execute(jobId: string): Promise<JobResult> {
    if (!this._queue) throw new Error('BullMQJobQueue not initialized. Call initialize() first.');

    const entry = this.executors.get(jobId);
    if (!entry) throw new Error(`Job not found: ${jobId}`);

    // Circuit breaker check
    if (this.circuitBreaker.isOpen(entry.type)) {
      const result: JobResult = {
        jobId,
        jobType: entry.type,
        status: 'failed',
        error: `Circuit breaker open for ${entry.type} — skipped`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        attempts: 0,
      };
      this.results.set(jobId, result);
      this.emit({ type: 'job:circuit-open', jobId, jobType: entry.type, result });
      return result;
    }

    const config = JOB_CONFIGS[entry.type] ?? { timeout: 30000, retries: 1 };

    // Add to BullMQ queue
    await this._queue.add(entry.type, {
      jobId,
      type: entry.type,
      input: entry.input,
    }, {
      attempts: config.retries + 1,
      backoff: { type: 'exponential', delay: 1000 },
      timeout: config.timeout,
    });

    // Wait for the worker to process and resolve
    return new Promise<JobResult>((resolve) => {
      this.pendingResolvers.set(jobId, resolve);
    });
  }

  // Execute multiple jobs in parallel
  async executeParallel(jobIds: string[]): Promise<JobResult[]> {
    const promises = jobIds.map(id => this.execute(id));
    const settled = await Promise.allSettled(promises);

    return settled.map((s, i) => {
      if (s.status === 'fulfilled') return s.value;
      return {
        jobId: jobIds[i],
        jobType: 'unknown',
        status: 'failed' as JobStatus,
        error: s.reason?.message ?? 'Unknown error',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        attempts: 1,
      };
    });
  }

  getResult(jobId: string): JobResult | undefined {
    return this.results.get(jobId);
  }

  getAllResults(): JobResult[] {
    return Array.from(this.results.values());
  }

  // Graceful shutdown
  async close(): Promise<void> {
    await this._worker?.close();
    await this._queue?.close();
    this._initialized = false;
  }
}
