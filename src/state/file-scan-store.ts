// File-backed ScanStore — persists scan history to data/orchestrator-runs.json.
// Wraps InMemoryScanStore for runtime operations, flushes to disk on updates.

import * as fs from 'fs';
import * as path from 'path';
import { ScanStore, InMemoryScanStore } from './scan-store';
import { ScanRecord } from '../orchestrator/scan-record';
import { JobResult } from '../queue/job-types';

const DEFAULT_PATH = path.resolve(process.cwd(), 'data', 'orchestrator-runs.json');

interface PersistedData {
  scans: ScanRecord[];
  jobResults: Record<string, JobResult[]>;
}

export class FileScanStore implements ScanStore {
  private inner: InMemoryScanStore;
  private filePath: string;
  private jobResultsMap: Map<string, JobResult[]> = new Map();

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_PATH;
    this.inner = new InMemoryScanStore();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data: PersistedData = JSON.parse(raw);
        for (const scan of data.scans ?? []) {
          void this.inner.createScan(scan);
        }
        for (const [scanId, results] of Array.from(Object.entries(data.jobResults ?? {}))) {
          this.jobResultsMap.set(scanId, results);
        }
      }
    } catch {
      // If file is corrupted or missing, start fresh
    }
  }

  private async flushToDisk(): Promise<void> {
    const scans = await this.inner.listScans();
    const jobResults: Record<string, JobResult[]> = {};
    for (const [scanId, results] of Array.from(this.jobResultsMap.entries())) {
      jobResults[scanId] = results;
    }
    const data: PersistedData = { scans, jobResults };

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  async createScan(scan: ScanRecord): Promise<void> {
    await this.inner.createScan(scan);
    await this.flushToDisk();
  }

  async updateScan(id: string, updates: Partial<ScanRecord>): Promise<void> {
    await this.inner.updateScan(id, updates);
    await this.flushToDisk();
  }

  async getScan(id: string): Promise<ScanRecord | null> {
    return this.inner.getScan(id);
  }

  async listScans(): Promise<ScanRecord[]> {
    return this.inner.listScans();
  }

  async addJobResult(scanId: string, result: JobResult): Promise<void> {
    await this.inner.addJobResult(scanId, result);
    const existing = this.jobResultsMap.get(scanId) ?? [];
    existing.push(result);
    this.jobResultsMap.set(scanId, existing);
  }

  async getJobResults(scanId: string): Promise<JobResult[]> {
    return this.jobResultsMap.get(scanId) ?? this.inner.getJobResults(scanId);
  }
}
