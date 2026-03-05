import fs from 'fs';
import path from 'path';
import { RunRecord } from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const RUNS_FILE = path.join(DATA_DIR, 'runs.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RUNS_FILE)) {
    fs.writeFileSync(RUNS_FILE, '[]', 'utf-8');
  }
}

export function getAllRuns(): RunRecord[] {
  ensureDataDir();
  const raw = fs.readFileSync(RUNS_FILE, 'utf-8');
  return JSON.parse(raw) as RunRecord[];
}

export function getRunById(id: string): RunRecord | null {
  const runs = getAllRuns();
  return runs.find(r => r.id === id) ?? null;
}

export function saveRun(run: RunRecord): void {
  ensureDataDir();
  const runs = getAllRuns();
  const idx = runs.findIndex(r => r.id === run.id);
  if (idx >= 0) {
    runs[idx] = run;
  } else {
    runs.unshift(run);
  }
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), 'utf-8');
}
