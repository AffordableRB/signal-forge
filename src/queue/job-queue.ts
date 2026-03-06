// In-memory job queue with typed contracts.
// Implements the same interface that BullMQ will use later.
//
// Each job:
// - Has typed inputs/outputs
// - Supports retries
// - Supports timeouts
// - Records results and errors

import { v4 as uuid } from 'uuid';
import { JobResult, JobStatus, JOB_CONFIGS } from './job-types';

export type JobExecutor<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

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

  // Execute a single job with timeout and retry logic
  async execute(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const startedAt = new Date().toISOString();
    const start = Date.now();
    job.status = 'running';

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= job.maxRetries; attempt++) {
      job.attempts = attempt + 1;

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
