'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StatusDot } from '@/components/status-dot';

interface RunSummary {
  id: string;
  date: string;
  status: 'running' | 'completed' | 'failed';
  topScore?: number;
  topOpportunity?: string;
  candidateCount?: number;
  error?: string;
}

export default function Dashboard() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [launching, setLaunching] = useState(false);

  const fetchRuns = useCallback(async () => {
    const res = await fetch('/api/runs');
    if (res.ok) setRuns(await res.json());
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Poll while any run is still running
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(fetchRuns, 2000);
    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  async function handleRunScan() {
    setLaunching(true);
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        // Navigate to run detail if completed immediately
        if (data.status === 'completed') {
          window.location.href = `/runs/${data.id}`;
          return;
        }
      }
      await fetchRuns();
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
          {launching ? 'Starting...' : 'Run Scan'}
        </button>
      </div>

      {runs.length === 0 ? (
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
