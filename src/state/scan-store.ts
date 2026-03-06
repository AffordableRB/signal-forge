// Scan store interface — abstracts persistence.
// Current implementation: in-memory.
// Future: Postgres-backed implementation swapped in.

import { ScanRecord } from '../orchestrator/scan-record';
import { JobResult } from '../queue/job-types';

export interface ScanStore {
  createScan(scan: ScanRecord): Promise<void>;
  updateScan(id: string, updates: Partial<ScanRecord>): Promise<void>;
  getScan(id: string): Promise<ScanRecord | null>;
  listScans(): Promise<ScanRecord[]>;
  addJobResult(scanId: string, result: JobResult): Promise<void>;
  getJobResults(scanId: string): Promise<JobResult[]>;
}

// ─── In-memory implementation ───────────────────────────────────────

export class InMemoryScanStore implements ScanStore {
  private scans: Map<string, ScanRecord> = new Map();
  private jobResults: Map<string, JobResult[]> = new Map();

  async createScan(scan: ScanRecord): Promise<void> {
    this.scans.set(scan.id, { ...scan });
  }

  async updateScan(id: string, updates: Partial<ScanRecord>): Promise<void> {
    const existing = this.scans.get(id);
    if (!existing) throw new Error(`Scan not found: ${id}`);
    this.scans.set(id, { ...existing, ...updates, updatedAt: new Date().toISOString() });
  }

  async getScan(id: string): Promise<ScanRecord | null> {
    return this.scans.get(id) ?? null;
  }

  async listScans(): Promise<ScanRecord[]> {
    return Array.from(this.scans.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async addJobResult(scanId: string, result: JobResult): Promise<void> {
    const existing = this.jobResults.get(scanId) ?? [];
    existing.push(result);
    this.jobResults.set(scanId, existing);
  }

  async getJobResults(scanId: string): Promise<JobResult[]> {
    return this.jobResults.get(scanId) ?? [];
  }
}
