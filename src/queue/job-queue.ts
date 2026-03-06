// In-memory job queue with typed contracts.
// Implements the same interface that BullMQ will use later.
//
// Each job:
// - Has typed inputs/outputs
// - Supports retries with exponential backoff
// - Supports timeouts
// - Records results and errors
// - Circuit breaker skips collectors that fail repeatedly

import { v4 as uuid } from 'uuid';
import { JobResult, JobStatus, JOB_CONFIGS } from './job-types';

// ─── Job event types ────────────────────────────────────────────────

export type JobEventType = 'job:start' | 'job:complete' | 'job:fail' | 'job:circuit-open';

export interface JobEvent {
  type: JobEventType;
  jobId: string;
  jobType: string;
  attempt?: number;
  maxRetries?: number;
  result?: JobResult;
  error?: string;
}

export type JobEventListener = (event: JobEvent) => void;

export type JobExecutor<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

// ─── Circuit breaker ────────────────────────────────────────────────

const CIRCUIT_BREAKER_THRESHOLD = 3;

export class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private openCircuits: Set<string> = new Set();

  recordFailure(jobType: string): void {
    const count = (this.failures.get(jobType) ?? 0) + 1;
    this.failures.set(jobType, count);
    if (count >= CIRCUIT_BREAKER_THRESHOLD) {
      this.openCircuits.add(jobType);
    }
  }

  recordSuccess(jobType: string): void {
    this.failures.set(jobType, 0);
  }

  isOpen(jobType: string): boolean {
    return this.openCircuits.has(jobType);
  }

  reset(jobType?: string): void {
    if (jobType) {
      this.failures.delete(jobType);
      this.openCircuits.delete(jobType);
    } else {
      this.failures.clear();
      this.openCircuits.clear();
    }
  }

  getOpenCircuits(): string[] {
    return Array.from(this.openCircuits);
  }
}

// ─── Backoff helper ─────────────────────────────────────────────────

function exponentialBackoffMs(attempt: number, baseMs: number = 1000, maxMs: number = 30000): number {
  const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  // Add jitter: +/- 25%
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Queue ──────────────────────────────────────────────────────────

interface QueuedJob<TInput = unknown, TOutput = unknown> {
  id: string;
  type: string;
  input: TInput;
  executor: JobExecutor<TInput, TOutput>;
  timeout: number;
  maxRetries: number;
  attempts: number;
  status: JobStatus;
  result?: JobResult<TOutput>;
}

export class JobQueue {
  private jobs: Map<string, QueuedJob> = new Map();
  private results: Map<string, JobResult> = new Map();
  private listeners: JobEventListener[] = [];
  readonly circuitBreaker: CircuitBreaker = new CircuitBreaker();

  onJobEvent(listener: JobEventListener): void {
    this.listeners.push(listener);
  }

  private emit(event: JobEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // Enqueue a job and return its ID
  enqueue<TInput, TOutput>(
    type: string,
    input: TInput,
    executor: JobExecutor<TInput, TOutput>,
  ): string {
    const config = JOB_CONFIGS[type] ?? { timeout: 30000, retries: 1 };
    const id = uuid();

    const job: QueuedJob<TInput, TOutput> = {
      id,
      type,
      input,
      executor,
      timeout: config.timeout,
      maxRetries: config.retries,
      attempts: 0,
      status: 'pending',
    };

    this.jobs.set(id, job as QueuedJob);
    return id;
  }

  // Execute a single job with timeout, exponential backoff retries, and circuit breaker
  async execute(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    // Circuit breaker check
    if (this.circuitBreaker.isOpen(job.type)) {
      const result: JobResult = {
        jobId,
        jobType: job.type,
        status: 'failed',
        error: `Circuit breaker open for ${job.type} — skipped`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        attempts: 0,
      };
      job.status = 'failed';
      job.result = result;
      this.results.set(jobId, result);
      this.emit({ type: 'job:circuit-open', jobId, jobType: job.type, result });
      return result;
    }

    const startedAt = new Date().toISOString();
    const start = Date.now();
    job.status = 'running';

    this.emit({
      type: 'job:start',
      jobId,
      jobType: job.type,
      attempt: 1,
      maxRetries: job.maxRetries,
    });

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= job.maxRetries; attempt++) {
      job.attempts = attempt + 1;

      // Exponential backoff before retries (not before first attempt)
      if (attempt > 0) {
        const backoffMs = exponentialBackoffMs(attempt - 1);
        await sleep(backoffMs);
      }

      try {
        const output = await Promise.race([
          job.executor(job.input),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Job timeout')), job.timeout)
          ),
        ]);

        const result: JobResult = {
          jobId,
          jobType: job.type,
          status: 'completed',
          output,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
          attempts: job.attempts,
        };

        job.status = 'completed';
        job.result = result;
        this.results.set(jobId, result);
        this.circuitBreaker.recordSuccess(job.type);
        this.emit({ type: 'job:complete', jobId, jobType: job.type, result });
        return result;

      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Unknown error';

        if (lastError === 'Job timeout') {
          // Don't retry on timeout
          break;
        }

        // Retry if attempts remain
        if (attempt < job.maxRetries) {
          continue;
        }
      }
    }

    // All attempts exhausted
    const isTimeout = lastError === 'Job timeout';
    const result: JobResult = {
      jobId,
      jobType: job.type,
      status: isTimeout ? 'timeout' : 'failed',
      error: lastError,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      attempts: job.attempts,
    };

    job.status = result.status;
    job.result = result;
    this.results.set(jobId, result);
    this.circuitBreaker.recordFailure(job.type);
    this.emit({ type: 'job:fail', jobId, jobType: job.type, result, error: lastError });
    return result;
  }

  // Execute multiple jobs in parallel, return all results
  async executeParallel(jobIds: string[]): Promise<JobResult[]> {
    const promises = jobIds.map(id => this.execute(id));
    const settled = await Promise.allSettled(promises);

    return settled.map((s, i) => {
      if (s.status === 'fulfilled') return s.value;
      return {
        jobId: jobIds[i],
        jobType: this.jobs.get(jobIds[i])?.type ?? 'unknown',
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
}
