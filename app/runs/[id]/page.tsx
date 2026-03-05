'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RunRecord, OpportunityCandidate } from '@/lib/types';
import { ScoreBar } from '@/components/score-bar';
import { RiskCount } from '@/components/risk-badge';
import { StatusDot } from '@/components/status-dot';
import { StarButton } from '@/components/star-button';
import { OpportunityDetail } from '@/components/opportunity-detail';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [selected, setSelected] = useState<OpportunityCandidate | null>(null);

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/runs/${params.id}`);
    if (res.ok) setRun(await res.json());
  }, [params.id]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const interval = setInterval(fetchRun, 2000);
    return () => clearInterval(interval);
  }, [run, fetchRun]);

  if (!run) {
    return <div className="text-neutral-500 text-sm">Loading...</div>;
  }

  if (run.status === 'running') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <StatusDot status="running" />
        <p className="text-neutral-400 text-sm">Pipeline is running...</p>
      </div>
    );
  }

  if (run.status === 'failed') {
    return (
      <div className="border border-red-900/50 rounded-lg p-8">
        <StatusDot status="failed" />
        <p className="text-red-400 text-sm mt-2">{run.error}</p>
      </div>
    );
  }

  const candidates = (run.candidates ?? [])
    .filter(c => !c.rejected)
    .sort((a, b) => b.scores.final - a.scores.final)
    .slice(0, 10);

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-neutral-500 hover:text-neutral-300 mb-6 flex items-center gap-1"
        >
          <span>&larr;</span> Back to results
        </button>
        <OpportunityDetail candidate={selected} runId={run.id} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          &larr; Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">
            Run {run.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {new Date(run.date).toLocaleString()} &middot; {run.candidateCount} candidates
          </p>
        </div>
        <StatusDot status={run.status} />
      </div>

      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-500 text-xs uppercase tracking-wider">
              <th className="px-2 py-3 font-medium w-8"></th>
              <th className="px-4 py-3 font-medium w-12">Rank</th>
              <th className="px-4 py-3 font-medium">Opportunity</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Demand</th>
              <th className="px-4 py-3 font-medium">Pain</th>
              <th className="px-4 py-3 font-medium">Pay</th>
              <th className="px-4 py-3 font-medium">Comp</th>
              <th className="px-4 py-3 font-medium">Ease</th>
              <th className="px-4 py-3 font-medium">Risks</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => setSelected(c)}
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30 cursor-pointer transition-colors"
              >
                <td className="px-2 py-3">
                  <StarButton candidate={c} runId={run.id} />
                </td>
                <td className="px-4 py-3 text-neutral-500 font-mono">{i + 1}</td>
                <td className="px-4 py-3 text-neutral-200 font-medium max-w-xs truncate">
                  {capitalize(c.jobToBeDone)}
                </td>
                <td className="px-4 py-3">
                  <ScoreBar score={c.scores.final} />
                </td>
                <td className="px-4 py-3 font-mono text-neutral-400">
                  {c.scores.breakdown['demand'] ?? '-'}
                </td>
                <td className="px-4 py-3 font-mono text-neutral-400">
                  {c.scores.breakdown['painIntensity'] ?? '-'}
                </td>
                <td className="px-4 py-3 font-mono text-neutral-400">
                  {c.scores.breakdown['abilityToPay'] ?? '-'}
                </td>
                <td className="px-4 py-3 font-mono text-neutral-400">
                  {c.scores.breakdown['competitionWeakness'] ?? '-'}
                </td>
                <td className="px-4 py-3 font-mono text-neutral-400">
                  {c.scores.breakdown['easeToBuild'] ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <RiskCount count={c.riskFlags.length} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
