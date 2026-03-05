import fs from 'fs';
import path from 'path';
import { OpportunityCandidate } from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');

export interface ScoreHistoryEntry {
  runId: string;
  createdAt: string;
  score: number;
}

export interface WatchlistEntry {
  key: string;
  snapshot: OpportunityCandidate;
  scoreHistory: ScoreHistoryEntry[];
  savedAt: string;
}

export interface WatchlistData {
  entries: Record<string, WatchlistEntry>;
}

function ensureFile(): WatchlistData {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(WATCHLIST_FILE)) {
    const empty: WatchlistData = { entries: {} };
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf-8'));
}

function save(data: WatchlistData): void {
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getWatchlist(): WatchlistEntry[] {
  const data = ensureFile();
  return Object.values(data.entries);
}

export function isWatched(key: string): boolean {
  const data = ensureFile();
  return key in data.entries;
}

export function toggleWatch(
  key: string,
  runId: string,
  snapshot: OpportunityCandidate
): boolean {
  const data = ensureFile();

  if (key in data.entries) {
    // Remove
    delete data.entries[key];
    save(data);
    return false; // no longer watched
  }

  // Add
  data.entries[key] = {
    key,
    snapshot,
    scoreHistory: [
      { runId, createdAt: new Date().toISOString(), score: snapshot.scores.final },
    ],
    savedAt: new Date().toISOString(),
  };
  save(data);
  return true; // now watched
}

// Update snapshots for all watched items from a new run's candidates
export function updateWatchlistFromRun(
  runId: string,
  candidates: OpportunityCandidate[],
  keyFn: (c: OpportunityCandidate) => string
): void {
  const data = ensureFile();
  for (const c of candidates) {
    const key = keyFn(c);
    if (key in data.entries) {
      const entry = data.entries[key];
      entry.snapshot = c;
      // Only add to history if this runId isn't already recorded
      if (!entry.scoreHistory.some(h => h.runId === runId)) {
        entry.scoreHistory.push({
          runId,
          createdAt: new Date().toISOString(),
          score: c.scores.final,
        });
      }
    }
  }
  save(data);
}
