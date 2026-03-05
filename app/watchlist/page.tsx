'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ScoreBar } from '@/components/score-bar';
import { RiskCount } from '@/components/risk-badge';

interface ScoreHistoryEntry {
  runId: string;
  createdAt: string;
  score: number;
}

interface WatchlistEntry {
  key: string;
  snapshot: {
    id: string;
    vertical: string;
    jobToBeDone: string;
    targetBuyer: string;
    scores: { final: number; breakdown: Record<string, number> };
    riskFlags: { id: string; severity: string; description: string }[];
  };
  scoreHistory: ScoreHistoryEntry[];
  savedAt: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function computeDelta(history: ScoreHistoryEntry[]): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return sorted[0].score - sorted[1].score;
}

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [riskOnly, setRiskOnly] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    const res = await fetch('/api/watchlist');
    if (res.ok) setEntries(await res.json());
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const filtered = entries.filter(e => {
    if (search && !e.snapshot.jobToBeDone.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (minScore > 0 && e.snapshot.scores.final < minScore) return false;
    if (riskOnly && e.snapshot.riskFlags.length === 0) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          &larr; Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">Watchlist</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {entries.length} saved opportunit{entries.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 w-48"
        />
        <select
          value={minScore}
          onChange={e => setMinScore(Number(e.target.value))}
          className="px-3 py-1.5 text-sm bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:border-neutral-600"
        >
          <option value={0}>All scores</option>
          <option value={5}>Score &ge; 5</option>
          <option value={6}>Score &ge; 6</option>
          <option value={7}>Score &ge; 7</option>
          <option value={8}>Score &ge; 8</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-500 cursor-pointer">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={e => setRiskOnly(e.target.checked)}
            className="rounded border-neutral-700 bg-neutral-900"
          />
          High risk only
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-12 text-center">
          <p className="text-neutral-500 text-sm">
            {entries.length === 0
              ? 'No saved opportunities yet. Star items from run results to add them here.'
              : 'No matches for current filters.'}
          </p>
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Opportunity</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Delta</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Risks</th>
                <th className="px-4 py-3 font-medium">Last Seen</th>
                <th className="px-4 py-3 font-medium">Runs</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => {
                const delta = computeDelta(entry.scoreHistory);
                const lastRun = entry.scoreHistory.length > 0
                  ? entry.scoreHistory[entry.scoreHistory.length - 1]
                  : null;

                return (
                  <tr
                    key={entry.key}
                    className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-neutral-200 font-medium max-w-xs truncate">
                      {lastRun ? (
                        <Link
                          href={`/runs/${lastRun.runId}`}
                          className="hover:text-emerald-400 transition-colors"
                        >
                          {capitalize(entry.snapshot.jobToBeDone)}
                        </Link>
                      ) : (
                        capitalize(entry.snapshot.jobToBeDone)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar score={entry.snapshot.scores.final} />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {delta === null ? (
                        <span className="text-neutral-600">-</span>
                      ) : delta > 0 ? (
                        <span className="text-emerald-400">+{delta.toFixed(1)}</span>
                      ) : delta < 0 ? (
                        <span className="text-red-400">{delta.toFixed(1)}</span>
                      ) : (
                        <span className="text-neutral-500">0.0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {entry.snapshot.vertical}
                    </td>
                    <td className="px-4 py-3">
                      <RiskCount count={entry.snapshot.riskFlags.length} />
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {lastRun ? new Date(lastRun.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 font-mono">
                      {entry.scoreHistory.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
