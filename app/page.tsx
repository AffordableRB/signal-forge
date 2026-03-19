'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RunRecord, CollectorStat, PhaseStatus, OpportunityCandidate } from '@/lib/types';
import { StatusDot } from '@/components/status-dot';
import Link from 'next/link';

const ALL_COLLECTORS = [
  'hackernews', 'search-intent', 'google-trends', 'stackexchange', 'github',
  'reddit', 'reviews', 'jobs', 'product-hunt', 'pricing', 'duckduckgo',
];

interface RawSignal {
  collectorId: string;
  timestamp: string;
  query: string;
  evidence: unknown[];
}

const ROUND_LABELS = ['Discovery', 'Deep Evidence', 'Cross-Validation', 'Analysis', 'Deep Validation'];

// --- Thorough scan steps ---

interface ThoroughStep {
  round: string;
  collectorId: string;
  queries: string[];
  options: Record<string, unknown>;
}

interface ThoroughProgress {
  totalSteps: number;
  currentStep: number;
  currentRound: string;
  currentCollector: string;
  signalsCollected: number;
  collectorStats: CollectorStat[];
  completedRounds: string[];
}

function buildThoroughPlan(queries: string[]): ThoroughStep[] {
  const steps: ThoroughStep[] = [];

  // Round 1: Discovery -- each collector gets ALL queries with high limits
  for (const collectorId of ALL_COLLECTORS) {
    steps.push({
      round: 'Discovery',
      collectorId,
      queries,
      options: {
        redditResultLimit: 50,
        subredditDepth: 6,
        reviewSnippetLimit: 20,
        pricingQueryCount: queries.length,
        jobResultLimit: 15,
      },
    });
  }

  return steps;
}

function buildRefinementSteps(topJobs: string[], round: string): ThoroughStep[] {
  const steps: ThoroughStep[] = [];
  const refinedQueries = topJobs.flatMap(j => [
    `"${j}" pain points frustrations reddit`,
    `"${j}" "too expensive" OR "waste of time" OR "no good option"`,
    `"${j}" small business freelancer problems`,
  ]);

  for (const collectorId of ALL_COLLECTORS) {
    steps.push({
      round,
      collectorId,
      queries: refinedQueries,
      options: {
        redditResultLimit: 30,
        subredditDepth: 4,
        reviewSnippetLimit: 15,
        pricingQueryCount: 3,
        jobResultLimit: 10,
      },
    });
  }

  return steps;
}

// --- Component ---

export default function Dashboard() {
  const [runs, setRuns] = useState<RunRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('signalforge_runs');
    return stored ? JSON.parse(stored) : [];
  });
  const [launching, setLaunching] = useState(false);
  const [topic, setTopic] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [thoroughProgress, setThoroughProgress] = useState<ThoroughProgress | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (launching) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [launching]);

  function persistRuns(updated: RunRecord[]) {
    setRuns(updated);
    localStorage.setItem('signalforge_runs', JSON.stringify(updated));
  }

  // --- Client-orchestrated scan ---

  const handleScan = useCallback(async () => {
    const scanTopic = topic.trim();
    if (!scanTopic) return;

    setLaunching(true);
    setScanError(null);
    abortRef.current = false;

    const allSignals: RawSignal[] = [];
    const allStats: CollectorStat[] = [];
    const phases: PhaseStatus[] = [];

    const progress: ThoroughProgress = {
      totalSteps: 0,
      currentStep: 0,
      currentRound: 'Discovery',
      currentCollector: '',
      signalsCollected: 0,
      collectorStats: [],
      completedRounds: [],
    };

    function updateProgress(updates: Partial<ThoroughProgress>) {
      Object.assign(progress, updates);
      setThoroughProgress({ ...progress });
    }

    async function runStep(step: ThoroughStep): Promise<void> {
      if (abortRef.current) return;

      updateProgress({
        currentRound: step.round,
        currentCollector: step.collectorId,
        currentStep: progress.currentStep + 1,
      });

      try {
        const res = await fetch('/api/scan/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collectorId: step.collectorId,
            queries: step.queries,
            options: step.options,
          }),
        });

        if (!res.ok) return;

        const { signals, stat } = await res.json();
        if (signals?.length) {
          allSignals.push(...signals);
        }
        if (stat) {
          allStats.push({ ...stat, id: `${step.round}:${stat.id}` });
          progress.collectorStats.push({ ...stat, id: `${step.round}:${stat.id}` });
        }

        updateProgress({
          signalsCollected: allSignals.reduce((n, s) => n + (s.evidence?.length ?? 0), 0),
        });
      } catch {
        allStats.push({
          id: `${step.round}:${step.collectorId}`,
          signalCount: 0,
          status: 'failed',
          durationMs: 0,
          error: 'Request failed',
        });
      }
    }

    try {
      // -- Generate topic-focused queries --
      let queries: string[];
      try {
        updateProgress({ currentRound: 'Generating queries...', currentCollector: 'AI' });
        const qRes = await fetch('/api/scan/generate-queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: scanTopic, count: 12 }),
        });
        if (qRes.ok) {
          const { queries: generated } = await qRes.json();
          queries = generated;
        } else {
          throw new Error('Query generation failed');
        }
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Failed to generate queries');
      }

      // -- Round 1: Discovery --
      const discoveryStart = Date.now();
      const discoverySteps = buildThoroughPlan(queries);
      updateProgress({ totalSteps: discoverySteps.length + 16 + 8 + 1 });

      for (const step of discoverySteps) {
        await runStep(step);
      }

      phases.push({
        id: 'discovery',
        label: 'Discovery',
        status: 'completed',
        durationMs: Date.now() - discoveryStart,
        signalsAdded: allSignals.length,
      });
      updateProgress({ completedRounds: ['Discovery'] });

      if (abortRef.current) throw new Error('Scan cancelled');

      // -- Intermediate analysis to find top candidates --
      const midAnalysisStart = Date.now();
      updateProgress({ currentRound: 'Analyzing...', currentCollector: 'clustering' });

      let topJobs: string[] = [];
      try {
        const midRes = await fetch('/api/scan/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signals: allSignals, topic: scanTopic }),
        });
        if (midRes.ok) {
          const { candidates } = await midRes.json();
          topJobs = (candidates as OpportunityCandidate[])
            .filter((c: OpportunityCandidate) => !c.rejected)
            .sort((a: OpportunityCandidate, b: OpportunityCandidate) => b.scores.final - a.scores.final)
            .slice(0, 4)
            .map((c: OpportunityCandidate) => c.jobToBeDone);
        }
      } catch {
        // Fall back — no refinement if mid-analysis fails
      }

      phases.push({
        id: 'mid-analysis',
        label: 'Mid-Scan Analysis',
        status: 'completed',
        durationMs: Date.now() - midAnalysisStart,
        signalsAdded: 0,
      });

      // -- Round 2: Deep Evidence (refined queries) --
      if (topJobs.length > 0 && !abortRef.current) {
        const deepStart = Date.now();
        const deepSteps = buildRefinementSteps(topJobs, 'Deep Evidence');
        const prevSignalCount = allSignals.length;

        updateProgress({ totalSteps: progress.currentStep + deepSteps.length + 8 + 1 });

        for (const step of deepSteps) {
          await runStep(step);
        }

        phases.push({
          id: 'deep-evidence',
          label: 'Deep Evidence',
          status: 'completed',
          durationMs: Date.now() - deepStart,
          signalsAdded: allSignals.length - prevSignalCount,
        });
        updateProgress({ completedRounds: [...progress.completedRounds, 'Deep Evidence'] });
      }

      if (abortRef.current) throw new Error('Scan cancelled');

      // -- Round 3: Cross-validation (different query angles) --
      if (topJobs.length > 0 && !abortRef.current) {
        const crossStart = Date.now();
        const prevSignalCount = allSignals.length;

        const validationQueries = topJobs.flatMap(j => [
          `"${j}" reviews complaints`,
          `${j} user experience issues`,
        ]);

        const validationCollectors = ['hackernews', 'search-intent', 'google-trends', 'reddit', 'reviews'];
        const crossSteps: ThoroughStep[] = validationCollectors.map(collectorId => ({
          round: 'Cross-Validation',
          collectorId,
          queries: validationQueries,
          options: { redditResultLimit: 20, subredditDepth: 3, reviewSnippetLimit: 10 },
        }));

        updateProgress({ totalSteps: progress.currentStep + crossSteps.length + 1 + 1 });

        for (const step of crossSteps) {
          await runStep(step);
        }

        phases.push({
          id: 'cross-validation',
          label: 'Cross-Validation',
          status: 'completed',
          durationMs: Date.now() - crossStart,
          signalsAdded: allSignals.length - prevSignalCount,
        });
        updateProgress({ completedRounds: [...progress.completedRounds, 'Cross-Validation'] });
      }

      if (abortRef.current) throw new Error('Scan cancelled');

      // -- Final Analysis --
      const finalStart = Date.now();
      updateProgress({ currentRound: 'Analysis', currentCollector: 'scoring & ranking' });

      const finalRes = await fetch('/api/scan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: allSignals }),
      });

      if (!finalRes.ok) {
        throw new Error('Final analysis failed');
      }

      const { candidates } = await finalRes.json();

      phases.push({
        id: 'analysis',
        label: 'Analysis',
        status: 'completed',
        durationMs: Date.now() - finalStart,
        signalsAdded: 0,
      });
      updateProgress({ completedRounds: [...progress.completedRounds, 'Analysis'] });

      if (abortRef.current) throw new Error('Scan cancelled');

      // -- Deep Validation --
      const validationStart = Date.now();
      updateProgress({ currentRound: 'Deep Validation', currentCollector: 'LLM validation' });

      const top5 = (candidates as OpportunityCandidate[])
        .filter((c: OpportunityCandidate) => !c.rejected)
        .sort((a: OpportunityCandidate, b: OpportunityCandidate) => b.scores.final - a.scores.final)
        .slice(0, 5);

      let finalCandidates = candidates as OpportunityCandidate[];

      if (top5.length > 0) {
        try {
          const valRes = await fetch('/api/scan/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidates: top5 }),
          });

          if (valRes.ok) {
            const { candidates: validatedCandidates } = await valRes.json();
            // Merge validated candidates back into the full list
            const validatedMap = new Map(
              (validatedCandidates as OpportunityCandidate[]).map((c: OpportunityCandidate) => [c.jobToBeDone, c])
            );
            finalCandidates = finalCandidates.map((c: OpportunityCandidate) =>
              validatedMap.get(c.jobToBeDone) ?? c
            );
          }
        } catch {
          // Validation is best-effort; continue with unvalidated candidates
        }
      }

      phases.push({
        id: 'deep-validation',
        label: 'Deep Validation',
        status: 'completed',
        durationMs: Date.now() - validationStart,
        signalsAdded: 0,
      });
      updateProgress({ completedRounds: [...progress.completedRounds, 'Deep Validation'] });

      // -- Build run record --
      const runId = crypto.randomUUID();
      const sorted = finalCandidates
        .filter((c: OpportunityCandidate) => !c.rejected)
        .sort((a: OpportunityCandidate, b: OpportunityCandidate) => b.scores.final - a.scores.final);

      const run: RunRecord = {
        id: runId,
        date: new Date().toISOString(),
        status: 'completed',
        scanMode: 'thorough',
        topic: scanTopic,
        phases,
        candidates: finalCandidates,
        candidateCount: finalCandidates.length,
        topScore: sorted[0]?.scores.final ?? 0,
        topOpportunity: sorted[0]?.jobToBeDone ?? 'N/A',
        collectorStats: allStats,
        queriesUsed: queries,
      };

      localStorage.setItem(`signalforge_run_${runId}`, JSON.stringify(run));
      persistRuns([run, ...runs]);
      window.location.href = `/runs/${runId}`;

    } catch (e) {
      if (!abortRef.current) {
        setScanError(e instanceof Error ? e.message : 'Scan failed');
      }
    } finally {
      setLaunching(false);
      setThoroughProgress(null);
    }
  }, [runs, topic]);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">SignalForge</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Discover niche business opportunities in any industry
            </p>
          </div>
        </div>

        {/* Topic input + scan button */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !launching && topic.trim()) handleScan(); }}
              disabled={launching}
              placeholder='Enter an industry to explore... e.g. "beauty", "fitness", "construction"'
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 text-sm placeholder-neutral-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {topic && !launching && (
              <button
                onClick={() => setTopic('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 text-xs"
              >
                clear
              </button>
            )}
          </div>
          <button
            onClick={handleScan}
            disabled={launching || !topic.trim()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            {launching ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {/* Hint */}
        {!launching && !scanError && !topic.trim() && (
          <p className="text-xs text-amber-500 mt-2">
            Enter an industry or topic to start scanning
          </p>
        )}
      </div>

      {scanError && (
        <div className="border border-red-900/50 bg-red-950/20 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm font-medium">Scan failed</p>
          <p className="text-red-400/70 text-xs mt-1">{scanError}</p>
        </div>
      )}

      {/* Scan progress */}
      {launching && thoroughProgress && (
        <div className="border border-emerald-900/30 bg-emerald-950/5 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-neutral-200 text-sm font-medium">
                  Scanning — {thoroughProgress.currentRound}
                </p>
                <p className="text-neutral-500 text-xs mt-0.5">
                  {elapsed}s elapsed · Step {thoroughProgress.currentStep}/{thoroughProgress.totalSteps} · {thoroughProgress.signalsCollected} evidence collected
                </p>
              </div>
            </div>
            <button
              onClick={() => { abortRef.current = true; }}
              className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Round progress */}
          <div className="flex gap-2 mb-4">
            {ROUND_LABELS.map(round => {
              const done = thoroughProgress.completedRounds.includes(round);
              const active = thoroughProgress.currentRound === round;
              return (
                <div key={round} className="flex-1">
                  <div className={`h-1.5 rounded-full transition-all duration-700 ${
                    done ? 'bg-emerald-500' :
                    active ? 'bg-emerald-500/60 animate-pulse' :
                    'bg-neutral-800'
                  }`} />
                  <p className={`text-[10px] mt-1 ${
                    done || active ? 'text-neutral-400' : 'text-neutral-700'
                  }`}>{round}</p>
                </div>
              );
            })}
          </div>

          {/* Current collector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-600">Collecting from:</span>
            <span className="text-xs text-neutral-300 font-mono">{thoroughProgress.currentCollector}</span>
          </div>

          {/* Recent collector results */}
          {thoroughProgress.collectorStats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {thoroughProgress.collectorStats.slice(-12).map((stat, i) => (
                <span
                  key={`${stat.id}-${i}`}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    stat.status === 'success' && stat.signalCount > 0
                      ? 'text-emerald-400 bg-emerald-950/40'
                      : stat.status === 'timeout'
                      ? 'text-amber-400 bg-amber-950/40'
                      : 'text-neutral-500 bg-neutral-800/40'
                  }`}
                >
                  {stat.id.split(':').pop()} {stat.signalCount > 0 ? `+${stat.signalCount}` : '0'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!launching && runs.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-12 text-center">
          <p className="text-neutral-500 text-sm">
            No runs yet. Enter a topic and click &quot;Scan&quot; to discover opportunities.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Topic</th>
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
                    <span className="text-xs text-neutral-300">
                      {run.topic ?? '-'}
                    </span>
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
