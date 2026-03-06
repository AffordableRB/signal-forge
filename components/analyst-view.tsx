'use client';

import { OpportunityCandidate } from '@/lib/types';
import { OpportunityRadarChart } from './charts/radar-chart';
import { SignalSourceChart } from './charts/signal-source-chart';
import { EvidenceTimelineChart } from './charts/evidence-timeline-chart';
import { CompetitionChart } from './charts/competition-chart';
import { ConfidenceBreakdownChart } from './charts/confidence-chart';

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function confidenceColor(v: number): string {
  if (v >= 70) return 'text-emerald-400';
  if (v >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function confidenceBg(v: number): string {
  if (v >= 70) return 'bg-emerald-500';
  if (v >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props {
  candidate: OpportunityCandidate;
}

export function AnalystView({ candidate: c }: Props) {
  const conf = c.confidence;
  const eco = c.economicImpact;
  const so = c.scoringOutput;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-neutral-100 border-b border-neutral-800 pb-2">
        Analyst View
      </h2>

      {/* Top-level metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Opportunity"
          value={c.scores.final.toFixed(1)}
          suffix="/10"
        />
        <MetricCard
          label="Confidence"
          value={conf ? `${conf.overall}` : '—'}
          suffix="%"
          color={conf ? confidenceColor(conf.overall) : undefined}
        />
        <MetricCard
          label="Evidence Quality"
          value={conf ? `${conf.evidenceQuality}` : '—'}
          suffix="%"
          color={conf ? confidenceColor(conf.evidenceQuality) : undefined}
        />
        <MetricCard
          label="Signal Relevance"
          value={conf ? `${conf.signalRelevance}` : '—'}
          suffix="%"
          color={conf ? confidenceColor(conf.signalRelevance) : undefined}
        />
        <MetricCard
          label="Contradictions"
          value={conf ? `${conf.contradictionScore}` : '—'}
          suffix="%"
          color={conf ? confidenceColor(100 - conf.contradictionScore) : undefined}
        />
        <MetricCard
          label="Data Freshness"
          value={conf ? `${conf.dataFreshness}` : '—'}
          suffix="%"
          color={conf ? confidenceColor(conf.dataFreshness) : undefined}
        />
      </div>

      {/* Scenario Economics */}
      {eco?.conservative && eco.base && eco.aggressive && (
        <div className="border border-neutral-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-neutral-300 mb-4">Economic Scenarios</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500 uppercase tracking-wider">
                  <th className="text-left py-2 pr-4">Metric</th>
                  <th className="text-right py-2 px-4">Conservative</th>
                  <th className="text-right py-2 px-4 text-neutral-300">Base</th>
                  <th className="text-right py-2 px-4">Aggressive</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <ScenarioRow
                  label="Time cost"
                  c={`${eco.conservative.timeCostHoursPerMonth}h`}
                  b={`${eco.base.timeCostHoursPerMonth}h`}
                  a={`${eco.aggressive.timeCostHoursPerMonth}h`}
                />
                <ScenarioRow
                  label="Labor cost/mo"
                  c={formatCurrency(eco.conservative.laborCostPerMonth)}
                  b={formatCurrency(eco.base.laborCostPerMonth)}
                  a={formatCurrency(eco.aggressive.laborCostPerMonth)}
                />
                <ScenarioRow
                  label="Revenue loss/mo"
                  c={formatCurrency(eco.conservative.revenueLossPerMonth)}
                  b={formatCurrency(eco.base.revenueLossPerMonth)}
                  a={formatCurrency(eco.aggressive.revenueLossPerMonth)}
                />
                <ScenarioRow
                  label="Total cost/mo"
                  c={formatCurrency(eco.conservative.totalMonthlyCost)}
                  b={formatCurrency(eco.base.totalMonthlyCost)}
                  a={formatCurrency(eco.aggressive.totalMonthlyCost)}
                  bold
                />
              </tbody>
            </table>
          </div>
          <div className="flex gap-6 mt-4 text-xs">
            {eco.impliedROIMultiple != null && (
              <div>
                <span className="text-neutral-500">Implied ROI: </span>
                <span className="text-emerald-400 font-mono font-bold">{eco.impliedROIMultiple.toFixed(1)}x</span>
              </div>
            )}
            {eco.paybackPeriodMonths != null && (
              <div>
                <span className="text-neutral-500">Payback: </span>
                <span className="text-emerald-400 font-mono font-bold">
                  {eco.paybackPeriodMonths < 1 ? '<1' : eco.paybackPeriodMonths.toFixed(1)} months
                </span>
              </div>
            )}
            {eco.confidence != null && (
              <div>
                <span className="text-neutral-500">Confidence: </span>
                <span className={`font-mono font-bold ${confidenceColor(eco.confidence)}`}>{eco.confidence}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contradictions */}
      {conf && conf.contradictions.contradictions.length > 0 && (
        <div className="border border-amber-900/30 bg-amber-950/10 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-3">
            Contradictions Detected ({conf.contradictions.contradictions.length})
          </h3>
          <div className="space-y-2">
            {conf.contradictions.contradictions.map(ct => (
              <div key={ct.id} className="flex items-start gap-2">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded mt-0.5 ${
                  ct.severity === 'high' ? 'text-red-400 bg-red-950/40' :
                  ct.severity === 'medium' ? 'text-amber-400 bg-amber-950/40' :
                  'text-neutral-400 bg-neutral-800'
                }`}>
                  {ct.severity}
                </span>
                <span className="text-sm text-neutral-400">{ct.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring reasons */}
      {so && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-lg p-4">
            <h4 className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Top Reasons It Wins</h4>
            <ul className="space-y-1">
              {so.topReasons.map((r, i) => (
                <li key={i} className="text-sm text-neutral-400 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">+</span> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-red-900/30 bg-red-950/10 rounded-lg p-4">
            <h4 className="text-xs text-red-400 uppercase tracking-wider mb-2">Top Reasons It Loses</h4>
            <ul className="space-y-1">
              {so.bottomReasons.map((r, i) => (
                <li key={i} className="text-sm text-neutral-400 flex items-start gap-1.5">
                  <span className="text-red-500 mt-0.5">−</span> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Evidence quality & noise summary */}
      {so && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-neutral-800 rounded-lg p-4">
            <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Evidence Quality</h4>
            <p className="text-sm text-neutral-400">{so.evidenceQualitySummary}</p>
          </div>
          <div className="border border-neutral-800 rounded-lg p-4">
            <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Excluded Noise</h4>
            <p className="text-sm text-neutral-400">{so.excludedNoiseSummary}</p>
          </div>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Opportunity Radar</h3>
          <OpportunityRadarChart detectorResults={c.detectorResults} />
        </div>

        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Weighted Signals by Source</h3>
          <SignalSourceChart evidence={c.evidence} />
        </div>

        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Evidence Timeline</h3>
          <EvidenceTimelineChart evidence={c.evidence} />
        </div>

        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Competition Landscape</h3>
          <CompetitionChart competitors={c.competitors} />
        </div>

        {conf && (
          <div className="border border-neutral-800 rounded-lg p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-neutral-300 mb-3">Confidence by Detector</h3>
            <ConfidenceBreakdownChart detectorConfidence={conf.detectorConfidence} />
          </div>
        )}
      </div>

      {/* Market structure confidence */}
      {c.marketStructure?.confidence != null && (
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>Market classification confidence:</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${confidenceBg(c.marketStructure.confidence)}`}
                style={{ width: `${c.marketStructure.confidence}%` }}
              />
            </div>
            <span className={confidenceColor(c.marketStructure.confidence)}>
              {c.marketStructure.confidence}%
            </span>
          </div>
          {c.marketStructure.adjacentCompetitorDensity != null && (
            <span>| Adjacent density: {c.marketStructure.adjacentCompetitorDensity}/10</span>
          )}
          {c.marketStructure.featureOverlapScore != null && (
            <span>| Feature overlap: {c.marketStructure.featureOverlapScore}/10</span>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, suffix, color }: {
  label: string;
  value: string;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3">
      <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color ?? 'text-neutral-100'}`}>
        {value}<span className="text-sm text-neutral-500">{suffix}</span>
      </div>
    </div>
  );
}

function ScenarioRow({ label, c, b, a, bold }: {
  label: string; c: string; b: string; a: string; bold?: boolean;
}) {
  return (
    <tr className={`border-t border-neutral-800/50 ${bold ? 'font-bold' : ''}`}>
      <td className="py-2 pr-4 text-neutral-400 text-xs">{label}</td>
      <td className="py-2 px-4 text-right text-neutral-500">{c}</td>
      <td className="py-2 px-4 text-right text-neutral-200">{b}</td>
      <td className="py-2 px-4 text-right text-neutral-500">{a}</td>
    </tr>
  );
}
