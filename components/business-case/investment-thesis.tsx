'use client';

import { OpportunityCandidate } from '@/lib/types';

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const VERDICT_BG = {
  'GO': 'from-emerald-950/40 to-emerald-950/10 border-emerald-500/40',
  'CONDITIONAL': 'from-amber-950/40 to-amber-950/10 border-amber-500/40',
  'NO-GO': 'from-red-950/40 to-red-950/10 border-red-500/40',
};

const VERDICT_ACCENT = {
  'GO': 'text-emerald-400',
  'CONDITIONAL': 'text-amber-400',
  'NO-GO': 'text-red-400',
};

interface Props {
  candidate: OpportunityCandidate;
}

export function InvestmentThesis({ candidate: c }: Props) {
  const dv = c.deepValidation;
  const mkt = c.marketSize;
  const eco = c.economicImpact;
  const score = c.scores.final;

  // If no deep validation and score is low, don't show the thesis
  if (!dv && score < 5) return null;

  const verdict = dv?.verdict ?? (score >= 6.5 ? 'GO' : score >= 5 ? 'CONDITIONAL' : 'NO-GO');
  const verdictLabel = verdict === 'GO' ? 'START THIS BUSINESS'
    : verdict === 'CONDITIONAL' ? 'VALIDATE FIRST'
    : 'DO NOT START';

  // Build the one-line gap statement
  const gap = dv?.exactGap ?? buildGapStatement(c);

  // Get the 3 strongest proof points (highest confidence, diverse signal types)
  const proofPoints = getStrongestProofs(c);

  // Build the math line
  const mathLine = mkt
    ? `$${mkt.avgMonthlyPrice}/mo x ${mkt.potentialCustomers.toLocaleString()} customers = ${formatCurrency(mkt.revenueCeiling)}/yr ceiling`
    : null;

  // Get the unfair advantage
  const unfairAdvantage = dv?.unfairAdvantage;

  // Get the biggest risk
  const biggestRisk = dv?.biggestRisk ?? c.riskFlags[0]?.description;

  return (
    <div className={`border-2 rounded-xl overflow-hidden bg-gradient-to-b ${VERDICT_BG[verdict]}`}>
      {/* Verdict Header */}
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-black tracking-tight ${VERDICT_ACCENT[verdict]}`}>
              {verdict}
            </div>
            <div>
              <div className={`text-sm font-bold uppercase tracking-wider ${VERDICT_ACCENT[verdict]}`}>
                {verdictLabel}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {dv ? `${dv.confidencePercent}% confidence` : `Score: ${score.toFixed(1)}/10`}
                {dv && ` | ${dv.checks.filter(ch => ch.passed).length}/${dv.checks.length} checks passed`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-neutral-100 font-mono">{score.toFixed(1)}</div>
            <div className="text-xs text-neutral-500">/10</div>
          </div>
        </div>

        {/* The Gap */}
        <div className="bg-black/30 rounded-lg p-4 mb-4">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">The Opportunity</div>
          <p className="text-base text-neutral-200 font-medium leading-relaxed">{gap}</p>
        </div>

        {/* The Math */}
        {mathLine && (
          <div className="bg-black/20 rounded-lg p-3 mb-4">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">The Math</div>
            <div className="text-sm text-emerald-400 font-mono">{mathLine}</div>
            {eco?.impliedROIMultiple && (
              <div className="text-xs text-neutral-500 mt-1">
                Problem costs buyers {formatCurrency(eco.totalMonthlyCost[0])}-{formatCurrency(eco.totalMonthlyCost[1])}/mo
                {eco.impliedROIMultiple > 1 && ` | ${eco.impliedROIMultiple}x ROI for the customer`}
              </div>
            )}
          </div>
        )}

        {/* 3 Proof Points */}
        {proofPoints.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">Evidence That Proves This</div>
            <div className="space-y-2">
              {proofPoints.map((proof, i) => (
                <div key={i} className="flex items-start gap-3 bg-black/15 rounded-lg p-3">
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    proof.type === 'pain' ? 'bg-red-900/50 text-red-400' :
                    proof.type === 'demand' ? 'bg-blue-900/50 text-blue-400' :
                    proof.type === 'money' ? 'bg-emerald-900/50 text-emerald-400' :
                    'bg-amber-900/50 text-amber-400'
                  }`}>
                    {proof.type === 'pain' ? 'P' : proof.type === 'demand' ? 'D' : proof.type === 'money' ? '$' : 'C'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-300 leading-snug">&ldquo;{proof.excerpt}&rdquo;</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-neutral-600">{proof.source}</span>
                      {proof.url && proof.url !== '#' && (
                        <a href={proof.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:text-blue-400">
                          source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unfair Advantage + Biggest Risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {unfairAdvantage && (
            <div className="bg-black/15 rounded-lg p-3">
              <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">What Makes This Winnable</div>
              <p className="text-sm text-neutral-300">{unfairAdvantage}</p>
            </div>
          )}
          {biggestRisk && (
            <div className="bg-black/15 rounded-lg p-3">
              <div className="text-[10px] text-red-500 uppercase tracking-wider mb-1">Biggest Risk</div>
              <p className="text-sm text-neutral-400">{biggestRisk}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function buildGapStatement(c: OpportunityCandidate): string {
  const buyer = c.targetBuyer;
  const job = c.jobToBeDone;
  const eco = c.economicImpact;
  const comp = c.competitors[0];

  let statement = `${buyer}s need to ${job}`;
  if (eco) {
    statement += `, losing ${formatCurrency(eco.totalMonthlyCost[0])}-${formatCurrency(eco.totalMonthlyCost[1])}/mo to this problem`;
  }
  if (comp) {
    const weakness = comp.weaknesses[0] ?? 'lacking';
    statement += `. Current solutions like ${comp.name} are ${weakness}`;
    if (comp.pricingRange) statement += ` at ${comp.pricingRange}`;
  }
  return statement + '.';
}

interface ProofPoint {
  type: string;
  excerpt: string;
  source: string;
  url: string;
  confidence: number;
}

function getStrongestProofs(c: OpportunityCandidate): ProofPoint[] {
  // Get the best evidence per signal type, prioritizing tier 1 and high confidence
  const byType = new Map<string, typeof c.evidence[0][]>();
  for (const e of c.evidence) {
    const existing = byType.get(e.signalType) ?? [];
    existing.push(e);
    byType.set(e.signalType, existing);
  }

  const proofs: ProofPoint[] = [];
  const typePriority = ['pain', 'money', 'demand', 'competition'];

  for (const type of typePriority) {
    const items = byType.get(type);
    if (!items || items.length === 0) continue;

    // Sort by tier (lower = better) then confidence (higher = better)
    const sorted = [...items].sort((a, b) => {
      const tierDiff = (a.sourceTier ?? 3) - (b.sourceTier ?? 3);
      if (tierDiff !== 0) return tierDiff;
      return (b.confidence ?? 0.5) - (a.confidence ?? 0.5);
    });

    const best = sorted[0];
    proofs.push({
      type,
      excerpt: best.excerpt.length > 200 ? best.excerpt.slice(0, 200) + '...' : best.excerpt,
      source: best.source,
      url: best.url,
      confidence: best.confidence ?? 0.5,
    });

    if (proofs.length >= 3) break;
  }

  return proofs;
}
