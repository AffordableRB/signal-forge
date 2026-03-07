// Simple file-based collector cache.
// Caches collector results by collectorId + query hash.
// Uses /tmp/ which works on Vercel (warm instances) and locally.
// TTL default: 4 hours — same topic re-scanned within that window skips network calls.

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';
import { RawSignal } from '../models/types';

const CACHE_DIR = path.join(
  process.env.VERCEL ? '/tmp' : process.cwd(),
  '.collector-cache',
);

const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CacheEntry {
  signals: RawSignal[];
  timestamp: number;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(collectorId: string, queries: string[]): string {
  const sorted = [...queries].sort();
  const hash = createHash('sha256')
    .update(`${collectorId}:${sorted.join('|')}`)
    .digest('hex')
    .slice(0, 16);
  return `${collectorId}-${hash}`;
}

function cachePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

export function getCached(
  collectorId: string,
  queries: string[],
  ttlMs: number = DEFAULT_TTL_MS,
): RawSignal[] | null {
  try {
    const key = cacheKey(collectorId, queries);
    const file = cachePath(key);

    if (!existsSync(file)) return null;

    const stat = statSync(file);
    const age = Date.now() - stat.mtimeMs;
    if (age > ttlMs) return null;

    const raw = readFileSync(file, 'utf-8');
    const entry: CacheEntry = JSON.parse(raw);

    // Only return cache if it had actual results
    // Don't cache empty results — those might be from broken collectors
    if (!entry.signals || entry.signals.length === 0) return null;

    console.log(`[Cache] HIT ${collectorId} (${queries.length} queries, age ${Math.round(age / 60000)}m)`);
    return entry.signals;
  } catch {
    return null;
  }
}

export function setCache(
  collectorId: string,
  queries: string[],
  signals: RawSignal[],
): void {
  // Don't cache empty results
  if (signals.length === 0) return;

  try {
    ensureCacheDir();
    const key = cacheKey(collectorId, queries);
    const entry: CacheEntry = { signals, timestamp: Date.now() };
    writeFileSync(cachePath(key), JSON.stringify(entry));
    console.log(`[Cache] STORE ${collectorId} (${signals.length} signals)`);
  } catch {
    // Cache write failure is non-fatal
  }
}

export function clearCache(): void {
  try {
    if (!existsSync(CACHE_DIR)) return;
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      unlinkSync(path.join(CACHE_DIR, file));
    }
    console.log(`[Cache] Cleared ${files.length} entries`);
  } catch {
    // Non-fatal
  }
}
