'use client';

import { useState, useEffect, useRef } from 'react';
import { RunRecord, ScanMode } from '@/lib/types';
import { StatusDot } from '@/components/status-dot';
import Link from 'next/link';

const SCAN_MODE_INFO: Record<ScanMode, { label: string; desc: string; phases: number }> = {
  quick:    { label: 'Quick',    desc: '~15s · Discovery + Analysis',                        phases: 2 },
  standard: { label: 'Standard', desc: '~30s · Discovery + Market Mapping + Analysis',       phases: 3 },
  deep:     { label: 'Deep',     desc: '~50s · All 5 phases with cross-validation',          phases: 5 },
};

const PHASE_LABELS = ['Discovery', 'Deep Evidence', 'Market Mapping', 'Cross-Validation', 'Final Analysis'];

export default function Dashboard() {
  const [runs, setRuns] = useState<RunRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = sessionStorage.getItem('signalforge_runs');
    return stored ? JSON.parse(stored) : [];
  });
  const [launching, setLaunching] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('standard');
  const [scanError, setScanError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (launching) {
      setElapsed(0);
      setCurrentPhase(0);
      timerRef.current = setInterval(() => {
        setElapsed(t => {
          // Estimate current phase based on elapsed time and scan mode
          const phaseCount = SCAN_MODE_INFO[scanMode].phases;
          const totalEstimate = scanMode === 'quick' ? 15 : scanMode === 'standard' ? 30 : 50;
          const phaseIdx = Math.min(phaseCount - 1, Math.floor((t + 1) / totalEstimate * phaseCount));
          setCurrentPhase(phaseIdx);
          return t + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [launching, scanMode]);

  function persistRuns(updated: RunRecord[]) {
    setRuns(updated);
    sessionStorage.setItem('signalforge_runs', JSON.stringify(updated));
  }

  async function handleRunScan() {
    setLaunching(true);
    setScanError(null);
    try {
      const res = await fetch(`/api/run?mode=${scanMode}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Server error (${res.status})`);
      }
      const run: RunRecord = await res.json();

      sessionStorage.setItem(`signalforge_run_${run.id}`, JSON.stringify(run));

      const updated = [run, ...runs];
      persistRuns(updated);

      if (run.status === 'completed') {
        window.location.href = `/runs/${run.id}`;
      } else if (run.status === 'failed') {
        setScanError(run.error ?? 'Scan failed');
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed — the request may have timed out. Try a Quick or Standard scan.');
    } finally {
      setLaunching(false);
    }
  }

  const modeInfo = SCAN_MODE_INFO[scanMode];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Run scans and explore ranked opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-neutral-700">
            {(['quick', 'standard', 'deep'] as ScanMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setScanMode(mode)}
                disabled={launching}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  scanMode === mode
                    ? 'bg-neutral-700 text-neutral-100'
                    : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
                } disabled:cursor-not-allowed`}
              >
                {SCAN_MODE_INFO[mode].label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRunScan}
            disabled={launching}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {launching ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Scan mode description */}
      {!launching && !scanError && (
        <p className="text-xs text-neutral-600 mb-4 -mt-4 text-right">
          {modeInfo.desc}
        </p>
      )}

      {scanError && (
        <div className="border border-red-900/50 bg-red-950/20 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm font-medium">Scan failed</p>
          <p className="text-red-400/70 text-xs mt-1">{scanError}</p>
        </div>
      )}

      {launching && (
        <div className="border border-neutral-800 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-neutral-200 text-sm font-medium">
                {SCAN_MODE_INFO[scanMode].label} Scan in progress...
              </p>
              <p className="text-neutral-500 text-xs mt-0.5">
                {elapsed}s elapsed · Phase {currentPhase + 1}/{modeInfo.phases}
              </p>
            </div>
          </div>

          {/* Phase progress steps */}
          <div className="flex gap-2 mb-4">
            {PHASE_LABELS.slice(0, modeInfo.phases).map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full transition-all duration-700 ${
                  i < currentPhase ? 'bg-emerald-500' :
                  i === currentPhase ? 'bg-emerald-500/60 animate-pulse' :
                  'bg-neutral-800'
                }`} />
                <p className={`text-[10px] mt-1 ${
                  i <= currentPhase ? 'text-neutral-400' : 'text-neutral-700'
                }`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!launching && runs.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-12 text-center">
          <p className="text-neutral-500 text-sm">
            No runs yet. Select a scan mode and click &quot;Run Scan&quot; to discover opportunities.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Mode</th>
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
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      run.scanMode === 'deep' ? 'text-purple-400 bg-purple-950/40' :
                      run.scanMode === 'quick' ? 'text-amber-400 bg-amber-950/40' :
                      'text-blue-400 bg-blue-950/40'
                    }`}>
                      {run.scanMode ?? 'standard'}
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
