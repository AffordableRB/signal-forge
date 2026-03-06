'use client';

import { OpportunityCandidate } from '@/lib/types';
import { ScoreBar } from './score-bar';
import { RiskBadge } from './risk-badge';
import { StarButton } from './star-button';
import { WhyThisExists } from './why-this-exists';
import { EvidenceTimeline } from './evidence-timeline';
import { AnalystView } from './analyst-view';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDetectorName(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const PRIMARY_DETECTORS = [
  'demand', 'painIntensity', 'abilityToPay', 'competitionWeakness',
  'easeToBuild', 'distributionAccess', 'workflowAnchor',
];

const OCEAN_COLORS = {
  red: 'text-red-400 bg-red-950/30 border-red-900/30',
  blue: 'text-blue-400 bg-blue-950/30 border-blue-900/30',
  purple: 'text-purple-400 bg-purple-950/30 border-purple-900/30',
};

interface Props {
  candidate: OpportunityCandidate;
  runId?: string;
}

export function OpportunityDetail({ candidate: c, runId = '' }: Props) {
  const primaryResults = c.detectorResults.filter(r => PRIMARY_DETECTORS.includes(r.detectorId));
  const supportingResults = c.detectorResults.filter(r => !PRIMARY_DETECTORS.includes(r.detectorId));
  const ms = c.marketStructure;
  const eco = c.economicImpact;
  const mkt = c.marketSize;
  const mom = c.momentum;
  const plan = c.validationPlan;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">
            {capitalize(c.jobToBeDone)}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className="px-2.5 py-1 text-xs font-medium rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
              {c.vertical}
            </span>
            {ms && (
              <span className={`px-2.5 py-1 text-xs font-medium rounded border ${OCEAN_COLORS[ms.type]}`}>
                {ms.type.toUpperCase()} OCEAN
              </span>
            )}
            {c.confidence && (
              <span className={`px-2.5 py-1 text-xs font-medium rounded border ${
                c.confidence.overall >= 70 ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/30' :
                c.confidence.overall >= 50 ? 'text-amber-400 bg-amber-950/30 border-amber-900/30' :
                'text-red-400 bg-red-950/30 border-red-900/30'
              }`}>
                {c.confidence.overall}% confidence
              </span>
            )}
            <span className="text-sm text-neutral-500">{c.targetBuyer}</span>
            <span className="text-sm text-neutral-600">&middot;</span>
            <span className="text-sm text-neutral-500">{c.triggerMoment}</span>
          </div>
        </div>
        {runId && <StarButton candidate={c} runId={runId} size="md" />}
      </div>

      {/* Why This Exists */}
      <WhyThisExists candidate={c} />

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-neutral-800 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Score</div>
          <div className="text-2xl font-bold text-neutral-100 font-mono">
            {c.scores.final.toFixed(1)}<span className="text-sm text-neutral-500">/10</span>
          </div>
        </div>
        {eco && (
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Monthly Cost of Problem</div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {formatCurrency(eco.totalMonthlyCost[0])}–{formatCurrency(eco.totalMonthlyCost[1])}
            </div>
          </div>
        )}
        {mkt && (
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Revenue Ceiling</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {formatCurrency(mkt.revenueCeiling)}<span className="text-sm text-neutral-500">/yr</span>
            </div>
          </div>
        )}
        {mom && (
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Momentum</div>
            <div className="text-2xl font-bold font-mono">
              {mom.growthRate > 0 ? (
                <span className="text-emerald-400">+{mom.growthRate}%</span>
              ) : mom.growthRate < 0 ? (
                <span className="text-red-400">{mom.growthRate}%</span>
              ) : (
                <span className="text-neutral-400">0%</span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">{mom.trend}</div>
          </div>
        )}
      </div>

      {/* Market Structure */}
      {ms && (
        <div className={`border rounded-lg p-5 ${OCEAN_COLORS[ms.type]}`}>
          <h3 className="text-sm font-semibold mb-2">
            Market: {ms.type.charAt(0).toUpperCase() + ms.type.slice(1)} Ocean
          </h3>
          <p className="text-sm opacity-90 mb-3">{ms.reason}</p>
          <div className="flex flex-wrap gap-4 text-xs opacity-75">
            <span>Competitors: ~{ms.competitorCount}</span>
            <span>Maturity: {ms.maturityLevel}</span>
            <span>Innovation gap: {ms.innovationGap}/10</span>
            <span>Pricing similarity: {ms.pricingSimilarity}/10</span>
          </div>
        </div>
      )}

      {/* Economic Impact */}
      {eco && (
        <div className="border border-neutral-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Economic Impact</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <div className="text-xs text-neutral-500">Time wasted</div>
              <div className="text-sm text-neutral-200 font-mono">{eco.timeCostHoursPerMonth}h/mo</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Labor cost</div>
              <div className="text-sm text-neutral-200 font-mono">
                {formatCurrency(eco.laborCostPerMonth[0])}–{formatCurrency(eco.laborCostPerMonth[1])}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Revenue loss</div>
              <div className="text-sm text-neutral-200 font-mono">
                {formatCurrency(eco.revenueLossPerMonth[0])}–{formatCurrency(eco.revenueLossPerMonth[1])}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Pain score</div>
              <div className="text-sm text-neutral-200 font-mono">{eco.economicPainScore}/10</div>
            </div>
          </div>
          <p className="text-xs text-neutral-500">{eco.explanation}</p>
        </div>
      )}

      {/* Market Size */}
      {mkt && (
        <div className="border border-neutral-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Market Size Estimate</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <div className="text-xs text-neutral-500">Addressable buyers</div>
              <div className="text-sm text-neutral-200 font-mono">{mkt.potentialBuyers.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Adoption rate</div>
              <div className="text-sm text-neutral-200 font-mono">{(mkt.adoptionRate * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Potential customers</div>
              <div className="text-sm text-neutral-200 font-mono">{mkt.potentialCustomers.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Avg price</div>
              <div className="text-sm text-neutral-200 font-mono">${mkt.avgMonthlyPrice}/mo</div>
            </div>
          </div>
          <p className="text-xs text-neutral-500">{mkt.explanation}</p>
        </div>
      )}

      {/* Risk flags */}
      {c.riskFlags.length > 0 && (
        <div className="border border-amber-900/30 bg-amber-950/20 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-3">Viability Warnings</h3>
          <div className="space-y-2">
            {c.riskFlags.map(flag => (
              <div key={flag.id} className="flex items-start gap-2">
                <RiskBadge flag={flag} />
                <span className="text-sm text-neutral-400">{flag.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purple Ocean Wedges */}
      {c.purpleOpportunities && c.purpleOpportunities.length > 0 && (
        <div className="border border-purple-900/30 bg-purple-950/10 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-purple-400 mb-3">
            Differentiation Wedges
          </h3>
          <div className="space-y-4">
            {c.purpleOpportunities.map((w, i) => (
              <div key={i} className="border border-purple-900/20 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-purple-300">{w.title}</span>
                  <span className="text-xs text-purple-500 font-mono">
                    F:{w.feasibility} I:{w.impact}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">{w.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Startup Concepts */}
      {c.startupConcepts && c.startupConcepts.length > 0 && (
        <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3">
            Startup Concepts
          </h3>
          <div className="space-y-4">
            {c.startupConcepts.map((sc, i) => (
              <div key={i} className="border border-emerald-900/20 rounded p-3">
                <div className="text-sm font-medium text-emerald-300 mb-1">{sc.name}</div>
                <p className="text-xs text-neutral-300 mb-2">{sc.oneLiner}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-neutral-500">
                  <div><span className="text-neutral-400">Wedge:</span> {sc.wedge.slice(0, 80)}</div>
                  <div><span className="text-neutral-400">Tech:</span> {sc.technology.slice(0, 80)}</div>
                  <div><span className="text-neutral-400">GTM:</span> {sc.goToMarket.slice(0, 80)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Breakdown */}
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-300">Score Breakdown</h3>
        </div>
        <div className="divide-y divide-neutral-800/50">
          {primaryResults.map(r => (
            <div key={r.detectorId} className="px-5 py-3 flex items-center gap-4">
              <div className="w-40 text-sm text-neutral-400 shrink-0">
                {formatDetectorName(r.detectorId)}
              </div>
              <ScoreBar score={r.score} />
              <div className="text-xs text-neutral-500 flex-1 truncate">
                {r.explanation}
              </div>
            </div>
          ))}
        </div>
        {supportingResults.length > 0 && (
          <>
            <div className="px-5 py-2 border-t border-neutral-800 bg-neutral-900/50">
              <span className="text-xs text-neutral-500 uppercase tracking-wider">
                Supporting Detectors
              </span>
            </div>
            <div className="divide-y divide-neutral-800/50">
              {supportingResults.map(r => (
                <div key={r.detectorId} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-40 text-sm text-neutral-500 shrink-0">
                    {formatDetectorName(r.detectorId)}
                  </div>
                  <ScoreBar score={r.score} />
                  <div className="text-xs text-neutral-600 flex-1 truncate">
                    {r.explanation}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Evidence Timeline */}
      <EvidenceTimeline evidence={c.evidence} />

      {/* Analyst View — Charts & Confidence Metrics */}
      <AnalystView candidate={c} />

      {/* Validation Plan */}
      {plan && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-300">7-Day Validation Plan</h3>
          </div>
          <div className="p-5 space-y-6">
            <div>
              <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
                Interview Questions
              </h4>
              <ol className="space-y-2">
                {plan.interviewQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-neutral-400 pl-4 border-l-2 border-neutral-800">
                    &ldquo;{q}&rdquo;
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
                Outreach Messages
              </h4>
              <div className="space-y-3">
                {plan.outreachMessages.map((m, i) => (
                  <div key={i} className="bg-neutral-900/50 rounded p-3">
                    <p className="text-sm text-neutral-400">&ldquo;{m}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
                Day-by-Day Plan
              </h4>
              <div className="space-y-2">
                {plan.sevenDayPlan.map((step, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-emerald-600 font-mono shrink-0">{i + 1}.</span>
                    <span className="text-neutral-400">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
