// Postgres-backed ScanStore scaffold.
// Implements the ScanStore interface with SQL queries against Postgres.
// Does NOT require Postgres to be running — this is a code scaffold only.
//
// To activate:
//   1. npm install pg
//   2. Set DATABASE_URL environment variable
//   3. Run the CREATE TABLE statements below against your database
//   4. Swap PostgresScanStore for InMemoryScanStore/FileScanStore

import { ScanStore } from './scan-store';
import { ScanRecord } from '../orchestrator/scan-record';
import { JobResult } from '../queue/job-types';

// ─── SQL Schema ─────────────────────────────────────────────────────
//
// Run these statements to set up the database:
//
// CREATE TABLE scans (
//   id            TEXT PRIMARY KEY,
//   mode          TEXT NOT NULL,
//   status        TEXT NOT NULL DEFAULT 'pending',
//   current_phase TEXT NOT NULL DEFAULT 'PENDING',
//   phases        JSONB NOT NULL DEFAULT '[]',
//   progress_pct  INTEGER NOT NULL DEFAULT 0,
//   queries       JSONB NOT NULL DEFAULT '[]',
//   signal_count  INTEGER NOT NULL DEFAULT 0,
//   candidate_count INTEGER NOT NULL DEFAULT 0,
//   top_score     REAL NOT NULL DEFAULT 0,
//   top_opportunity TEXT NOT NULL DEFAULT 'N/A',
//   started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   completed_at  TIMESTAMPTZ,
//   error_summary TEXT
// );
//
// CREATE TABLE job_results (
//   id            SERIAL PRIMARY KEY,
//   scan_id       TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
//   job_id        TEXT NOT NULL,
//   job_type      TEXT NOT NULL,
//   status        TEXT NOT NULL,
//   output        JSONB,
//   error         TEXT,
//   started_at    TIMESTAMPTZ NOT NULL,
//   completed_at  TIMESTAMPTZ NOT NULL,
//   duration_ms   INTEGER NOT NULL,
//   attempts      INTEGER NOT NULL DEFAULT 1
// );
//
// CREATE INDEX idx_job_results_scan_id ON job_results(scan_id);
// CREATE INDEX idx_scans_status ON scans(status);
// CREATE INDEX idx_scans_started_at ON scans(started_at DESC);

// ─── Postgres client type stub ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgPool = any;

// ─── Helper: row → ScanRecord ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToScanRecord(row: any): ScanRecord {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    currentPhase: row.current_phase,
    phases: row.phases,
    progressPercent: row.progress_pct,
    queries: row.queries,
    signalCount: row.signal_count,
    candidateCount: row.candidate_count,
    topScore: row.top_score,
    topOpportunity: row.top_opportunity,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    errorSummary: row.error_summary ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJobResult(row: any): JobResult {
  return {
    jobId: row.job_id,
    jobType: row.job_type,
    status: row.status,
    output: row.output ?? undefined,
    error: row.error ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    attempts: row.attempts,
  };
}

// ─── Implementation ─────────────────────────────────────────────────

export class PostgresScanStore implements ScanStore {
  private pool: PgPool;

  constructor(databaseUrl?: string) {
    const url = databaseUrl ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required for PostgresScanStore');
    }

    // Dynamic require to avoid compile-time dependency on pg
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString: url });
    } catch {
      throw new Error('pg is not installed. Run: npm install pg');
    }
  }

  async createScan(scan: ScanRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO scans (id, mode, status, current_phase, phases, progress_pct, queries,
        signal_count, candidate_count, top_score, top_opportunity, started_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        scan.id, scan.mode, scan.status, scan.currentPhase,
        JSON.stringify(scan.phases), scan.progressPercent,
        JSON.stringify(scan.queries), scan.signalCount,
        scan.candidateCount, scan.topScore, scan.topOpportunity,
        scan.startedAt, scan.updatedAt,
      ],
    );
  }

  async updateScan(id: string, updates: Partial<ScanRecord>): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      status: 'status',
      currentPhase: 'current_phase',
      phases: 'phases',
      progressPercent: 'progress_pct',
      signalCount: 'signal_count',
      candidateCount: 'candidate_count',
      topScore: 'top_score',
      topOpportunity: 'top_opportunity',
      completedAt: 'completed_at',
      errorSummary: 'error_summary',
    };

    for (const [key, column] of Array.from(Object.entries(fieldMap))) {
      if (key in updates) {
        const val = updates[key as keyof ScanRecord];
        setClauses.push(`${column} = $${paramIdx}`);
        values.push(key === 'phases' ? JSON.stringify(val) : val);
        paramIdx++;
      }
    }

    // Always update updated_at
    setClauses.push(`updated_at = $${paramIdx}`);
    values.push(new Date().toISOString());
    paramIdx++;

    values.push(id);

    await this.pool.query(
      `UPDATE scans SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      values,
    );
  }

  async getScan(id: string): Promise<ScanRecord | null> {
    const { rows } = await this.pool.query('SELECT * FROM scans WHERE id = $1', [id]);
    return rows.length > 0 ? rowToScanRecord(rows[0]) : null;
  }

  async listScans(): Promise<ScanRecord[]> {
    const { rows } = await this.pool.query('SELECT * FROM scans ORDER BY started_at DESC');
    return rows.map(rowToScanRecord);
  }

  async addJobResult(scanId: string, result: JobResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO job_results (scan_id, job_id, job_type, status, output, error,
        started_at, completed_at, duration_ms, attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        scanId, result.jobId, result.jobType, result.status,
        result.output ? JSON.stringify(result.output) : null,
        result.error ?? null, result.startedAt, result.completedAt,
        result.durationMs, result.attempts,
      ],
    );
  }

  async getJobResults(scanId: string): Promise<JobResult[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM job_results WHERE scan_id = $1 ORDER BY id',
      [scanId],
    );
    return rows.map(rowToJobResult);
  }

  // Graceful shutdown
  async close(): Promise<void> {
    await this.pool.end();
  }
}
