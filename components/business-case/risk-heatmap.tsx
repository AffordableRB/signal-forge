'use client';

import { OpportunityCandidate } from '@/lib/types';

interface Props {
  candidate: OpportunityCandidate;
}

interface RiskItem {
  label: string;
  likelihood: number; // 0-1
  impact: number; // 0-1
  source: 'risk-flag' | 'kill-reason' | 'contradiction';
}

function classifyRisk(likelihood: number, impact: number): { color: string; bg: string; label: string } {
  if (likelihood > 0.6 && impact > 0.6) return { color: 'text-red-400', bg: 'bg-red-500', label: 'CRITICAL' };
  if (likelihood > 0.6 || impact > 0.6) return { color: 'text-orange-400', bg: 'bg-orange-500', label: 'HIGH' };
  if (likelihood > 0.3 && impact > 0.3) return { color: 'text-amber-400', bg: 'bg-amber-500', label: 'MEDIUM' };
  return { color: 'text-neutral-400', bg: 'bg-neutral-500', label: 'LOW' };
}

export function RiskHeatmap({ candidate: c }: Props) {
  const risks: RiskItem[] = [];

  // Risk flags
  for (const flag of c.riskFlags) {
    risks.push({
      label: flag.description,
      likelihood: flag.severity === 'high' ? 0.8 : flag.severity === 'medium' ? 0.5 : 0.3,
      impact: flag.severity === 'high' ? 0.8 : flag.severity === 'medium' ? 0.6 : 0.3,
      source: 'risk-flag',
    });
  }

  // Kill reasons from deep validation
  if (c.deepValidation?.killReasons) {
    for (const kr of c.deepValidation.killReasons) {
      risks.push({
        label: kr,
        likelihood: 0.5,
        impact: 0.8, // Kill reasons are high-impact by definition
        source: 'kill-reason',
      });
    }
  }

  // Contradictions
  if (c.confidence?.contradictions?.contradictions) {
    for (const contr of c.confidence.contradictions.contradictions) {
      risks.push({
        label: contr.description,
        likelihood: contr.severity === 'high' ? 0.7 : contr.severity === 'medium' ? 0.5 : 0.3,
        impact: contr.severity === 'high' ? 0.7 : contr.severity === 'medium' ? 0.5 : 0.3,
        source: 'contradiction',
      });
    }
  }

  if (risks.length === 0) {
    return (
      <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-emerald-400 mb-1">Risk Assessment</h3>
        <p className="text-xs text-neutral-500">No significant risks identified. Proceed with standard validation.</p>
      </div>
    );
  }

  // Categorize risks into quadrants
  const critical = risks.filter(r => r.likelihood > 0.6 && r.impact > 0.6);
  const highLikelihood = risks.filter(r => r.likelihood > 0.6 && r.impact <= 0.6);
  const highImpact = risks.filter(r => r.likelihood <= 0.6 && r.impact > 0.6);
  const low = risks.filter(r => r.likelihood <= 0.6 && r.impact <= 0.6);

  return (
    <div className="border border-neutral-800 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-neutral-300 mb-4">Risk Heatmap</h3>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-px bg-neutral-800 rounded-lg overflow-hidden mb-4">
        {/* Top-left: High likelihood, low impact */}
        <div className="bg-amber-950/10 p-3 min-h-[100px]">
          <div className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-2">
            Likely but Manageable
          </div>
          {highLikelihood.length > 0 ? (
            <div className="space-y-1.5">
              {highLikelihood.map((r, i) => (
                <RiskDot key={i} risk={r} />
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-neutral-700 italic">None</div>
          )}
        </div>

        {/* Top-right: High likelihood, high impact — CRITICAL */}
        <div className="bg-red-950/15 p-3 min-h-[100px]">
          <div className="text-[10px] text-red-400/60 uppercase tracking-wider mb-2">
            Critical Risks
          </div>
          {critical.length > 0 ? (
            <div className="space-y-1.5">
              {critical.map((r, i) => (
                <RiskDot key={i} risk={r} />
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-neutral-700 italic">None</div>
          )}
        </div>

        {/* Bottom-left: Low likelihood, low impact */}
        <div className="bg-neutral-900/50 p-3 min-h-[100px]">
          <div className="text-[10px] text-neutral-500/60 uppercase tracking-wider mb-2">
            Monitor
          </div>
          {low.length > 0 ? (
            <div className="space-y-1.5">
              {low.map((r, i) => (
                <RiskDot key={i} risk={r} />
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-neutral-700 italic">None</div>
          )}
        </div>

        {/* Bottom-right: Low likelihood, high impact */}
        <div className="bg-orange-950/10 p-3 min-h-[100px]">
          <div className="text-[10px] text-orange-400/60 uppercase tracking-wider mb-2">
            Unlikely but Severe
          </div>
          {highImpact.length > 0 ? (
            <div className="space-y-1.5">
              {highImpact.map((r, i) => (
                <RiskDot key={i} risk={r} />
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-neutral-700 italic">None</div>
          )}
        </div>
      </div>

      {/* Axis labels */}
      <div className="flex justify-between text-[10px] text-neutral-600 mb-1">
        <span>Low Impact &#8594; High Impact</span>
      </div>
      <div className="flex justify-between text-[10px] text-neutral-600">
        <span>&#8593; High Likelihood</span>
        <span>&#8595; Low Likelihood</span>
      </div>

      {/* Risk count summary */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-neutral-800">
        {critical.length > 0 && (
          <span className="text-xs text-red-400">{critical.length} critical</span>
        )}
        {(highLikelihood.length + highImpact.length) > 0 && (
          <span className="text-xs text-orange-400">{highLikelihood.length + highImpact.length} elevated</span>
        )}
        {low.length > 0 && (
          <span className="text-xs text-neutral-500">{low.length} low</span>
        )}
        <span className="text-xs text-neutral-600 ml-auto">{risks.length} total risks</span>
      </div>
    </div>
  );
}

function RiskDot({ risk }: { risk: RiskItem }) {
  const cls = classifyRisk(risk.likelihood, risk.impact);
  const sourceLabel = risk.source === 'kill-reason' ? 'Kill' :
    risk.source === 'contradiction' ? 'Data' : 'Flag';

  return (
    <div className="flex items-start gap-2">
      <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${cls.bg}`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-neutral-400 leading-tight block">
          {risk.label.length > 100 ? risk.label.slice(0, 100) + '...' : risk.label}
        </span>
        <span className={`text-[10px] ${cls.color}`}>{sourceLabel}</span>
      </div>
    </div>
  );
}
