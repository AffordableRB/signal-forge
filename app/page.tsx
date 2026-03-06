'use client';

import { useState, useEffect, useRef } from 'react';
import { RunRecord } from '@/lib/types';
import { StatusDot } from '@/components/status-dot';
import Link from 'next/link';

export default function Dashboard() {
  const [runs, setRuns] = useState<RunRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = sessionStorage.getItem('signalforge_runs');
    return stored ? JSON.parse(stored) : [];
  });
  const [launching, setLaunching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (launching) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [launching]);

  function persistRuns(updated: RunRecord[]) {
    setRuns(updated);
    sessionStorage.setItem('signalforge_runs', JSON.stringify(updated));
  }

  async function handleRunScan() {
    setLaunching(true);
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      const run: RunRecord = await res.json();

      // Store full run data for the detail page
      sessionStorage.setItem(`signalforge_run_${run.id}`, JSON.stringify(run));

      const updated = [run, ...runs];
      persistRuns(updated);

      if (run.status === 'completed') {
        window.location.href = `/runs/${run.id}`;
      }
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Run scans and explore ranked opportunities
          </p>
        </div>
        <button
          onClick={handleRunScan}
          disabled={launching}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {launching ? 'Scanning...' : 'Run Scan'}
        </button>
      </div>

      {launching && (
        <div className="border border-neutral-800 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-neutral-200 text-sm font-medium">Scanning market signals...</p>
              <p className="text-neutral-500 text-xs mt-0.5">{elapsed}s elapsed — collecting from Reddit, HN, Google, reviews, job boards</p>
            </div>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(95, elapsed * 3)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-neutral-600 mt-2">
            <span>Collecting</span>
            <span>Clustering</span>
            <span>Scoring</span>
            <span>Ranking</span>
          </div>
        </div>
      )}

      {!launching && runs.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-12 text-center">
          <p className="text-neutral-500 text-sm">
            No runs yet. Click &quot;Run Scan&quot; to discover opportunities.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Top Score</th>
                <th className="px-4 py-3 font-medium">Top Opportunity</th>
                <th className="px-4 py-3 font-medium">Candidates</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr
                  key={run.id}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    {run.status === 'completed' ? (
                      <Link
                        href={`/runs/${run.id}`}
                        className="text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                      >
                        {run.id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-neutral-400">
                        {run.id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {new Date(run.date).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={run.status} />
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {run.topScore?.toFixed(1) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 max-w-xs truncate">
                    {run.topOpportunity ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {run.candidateCount ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
