'use client';

import { OpportunityCandidate } from '@/lib/types';
import { generateValidationPlan } from '@/lib/validation';
import { ScoreBar } from './score-bar';
import { RiskBadge } from './risk-badge';
import { StarButton } from './star-button';
import { WhyThisExists } from './why-this-exists';
import { EvidenceTimeline } from './evidence-timeline';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDetectorName(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

const PRIMARY_DETECTORS = [
  'demand', 'painIntensity', 'abilityToPay', 'competitionWeakness',
  'easeToBuild', 'distributionAccess', 'workflowAnchor',
];

interface Props {
  candidate: OpportunityCandidate;
  runId?: string;
}

export function OpportunityDetail({ candidate: c, runId = '' }: Props) {
  const plan = generateValidationPlan(c);
  const primaryResults = c.detectorResults.filter(r => PRIMARY_DETECTORS.includes(r.detectorId));
  const supportingResults = c.detectorResults.filter(r => !PRIMARY_DETECTORS.includes(r.detectorId));

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
            <span className="text-sm text-neutral-500">{c.targetBuyer}</span>
            <span className="text-sm text-neutral-600">&middot;</span>
            <span className="text-sm text-neutral-500">{c.triggerMoment}</span>
          </div>
        </div>
        {runId && <StarButton candidate={c} runId={runId} size="md" />}
      </div>

      {/* Why This Exists */}
      <WhyThisExists candidate={c} />

      {/* Score card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-neutral-800 rounded-lg p-5">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
            Final Score
          </div>
          <div className="text-3xl font-bold text-neutral-100 font-mono">
            {c.scores.final.toFixed(1)}
            <span className="text-base text-neutral-500 font-normal"> / 10</span>
          </div>
        </div>
        <div className="border border-neutral-800 rounded-lg p-5">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
            Evidence Count
          </div>
          <div className="text-3xl font-bold text-neutral-100 font-mono">
            {c.evidence.length}
          </div>
        </div>
        <div className="border border-neutral-800 rounded-lg p-5">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
            Risk Flags
          </div>
          <div className="text-3xl font-bold font-mono">
            {c.riskFlags.length === 0 ? (
              <span className="text-emerald-500">0</span>
            ) : (
              <span className="text-amber-400">{c.riskFlags.length}</span>
            )}
          </div>
        </div>
      </div>

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

      {/* Competitors */}
      {c.competitors.length > 0 && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-300">Competitors</h3>
          </div>
          <div className="divide-y divide-neutral-800/50">
            {c.competitors.map((comp, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-200">{comp.name}</span>
                  {comp.reviewScore && (
                    <span className="text-xs text-neutral-500">{comp.reviewScore}/5</span>
                  )}
                  {comp.pricingRange && (
                    <span className="text-xs text-neutral-600">{comp.pricingRange}</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Weaknesses: {comp.weaknesses.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Plan */}
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
                  <div className="text-xs text-neutral-500 mb-1">{m.label}</div>
                  <p className="text-sm text-neutral-400">&ldquo;{m.message}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
              Validation Experiments
            </h4>
            <div className="space-y-2">
              {plan.experiments.map((ex, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-emerald-600 text-sm font-mono shrink-0">{i + 1}.</span>
                  <div>
                    <span className="text-sm text-neutral-300 font-medium">{ex.label}: </span>
                    <span className="text-sm text-neutral-500">{ex.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
              Day-by-Day Schedule
            </h4>
            <div className="space-y-1">
              {plan.schedule.map((s, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-neutral-500 font-mono w-20 shrink-0">{s.days}</span>
                  <span className="text-neutral-400">{s.task}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
