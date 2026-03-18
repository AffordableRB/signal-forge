'use client';

import { OpportunityCandidate } from '@/lib/types';

interface Props {
  candidate: OpportunityCandidate;
}

function parseNumber(s: string): number {
  const match = s.match(/[\d,.]+/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
}

function healthColor(ratio: number): string {
  if (ratio >= 5) return 'text-emerald-400';
  if (ratio >= 3) return 'text-emerald-400/70';
  if (ratio >= 2) return 'text-amber-400';
  if (ratio >= 1) return 'text-orange-400';
  return 'text-red-400';
}

function healthBg(ratio: number): string {
  if (ratio >= 5) return 'bg-emerald-500/20 border-emerald-500/30';
  if (ratio >= 3) return 'bg-emerald-500/10 border-emerald-500/20';
  if (ratio >= 2) return 'bg-amber-500/10 border-amber-500/20';
  if (ratio >= 1) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function healthLabel(ratio: number): string {
  if (ratio >= 5) return 'EXCELLENT';
  if (ratio >= 3) return 'HEALTHY';
  if (ratio >= 2) return 'MARGINAL';
  if (ratio >= 1) return 'RISKY';
  return 'UNSUSTAINABLE';
}

export function UnitEconomicsVisual({ candidate: c }: Props) {
  const dv = c.deepValidation;
  const eco = c.economicImpact;

  // Try to get unit economics from deep validation first, then estimate
  let cac = 0, ltv = 0, margin = '', revenue100 = '', breakEven = 0, reasoning = '';

  if (dv?.unitEconomics) {
    cac = parseNumber(dv.unitEconomics.estimatedCAC);
    ltv = parseNumber(dv.unitEconomics.estimatedLTV);
    margin = dv.unitEconomics.estimatedMargin;
    revenue100 = dv.unitEconomics.monthlyRevenueAt100Customers;
    breakEven = dv.unitEconomics.breakEvenCustomers;
    reasoning = dv.unitEconomics.reasoning;
  } else if (eco) {
    // Estimate from economic impact data
    const price = c.marketSize?.avgMonthlyPrice ?? 99;
    const distScore = c.detectorResults.find(r => r.detectorId === 'distributionAccess')?.score ?? 5;
    cac = Math.round(200 - (distScore * 15)); // $50-$200 based on distribution
    const workflowScore = c.detectorResults.find(r => r.detectorId === 'workflowAnchor')?.score ?? 5;
    const churn = Math.max(0.02, 0.10 - (workflowScore * 0.01));
    const avgLifeMonths = 1 / churn;
    ltv = Math.round(price * avgLifeMonths * 0.8);
    margin = '~80%';
    revenue100 = `$${(price * 100).toLocaleString()}`;
    breakEven = Math.max(1, Math.ceil(500 / (price * 0.8)));
    reasoning = 'Estimated from detector scores and vertical benchmarks.';
  }

  if (cac === 0 && ltv === 0) return null;

  const ratio = cac > 0 ? ltv / cac : 0;
  const paybackMonths = cac > 0 && c.marketSize
    ? cac / (c.marketSize.avgMonthlyPrice * 0.8)
    : 0;

  return (
    <div className={`border rounded-lg p-5 ${healthBg(ratio)}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-300">Unit Economics</h3>
        <span className={`text-xs font-bold uppercase tracking-wider ${healthColor(ratio)}`}>
          {healthLabel(ratio)}
        </span>
      </div>

      {/* Pipeline visual */}
      <div className="flex items-center justify-between gap-2 mb-6">
        {/* CAC */}
        <div className="flex-1 text-center">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">CAC</div>
          <div className="text-xl font-bold text-red-400 font-mono">
            ${cac.toLocaleString()}
          </div>
          <div className="text-[10px] text-neutral-600">to acquire</div>
        </div>

        {/* Arrow */}
        <div className="text-neutral-700 text-lg shrink-0">&#8594;</div>

        {/* LTV */}
        <div className="flex-1 text-center">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">LTV</div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            ${ltv.toLocaleString()}
          </div>
          <div className="text-[10px] text-neutral-600">lifetime value</div>
        </div>

        {/* Arrow */}
        <div className="text-neutral-700 text-lg shrink-0">&#8594;</div>

        {/* LTV:CAC Ratio */}
        <div className="flex-1 text-center">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">LTV:CAC</div>
          <div className={`text-xl font-bold font-mono ${healthColor(ratio)}`}>
            {ratio.toFixed(1)}x
          </div>
          <div className="text-[10px] text-neutral-600">{ratio >= 3 ? 'healthy' : ratio >= 1 ? 'needs work' : 'broken'}</div>
        </div>

        {/* Arrow */}
        <div className="text-neutral-700 text-lg shrink-0">&#8594;</div>

        {/* Payback */}
        <div className="flex-1 text-center">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Payback</div>
          <div className={`text-xl font-bold font-mono ${
            paybackMonths <= 6 ? 'text-emerald-400' :
            paybackMonths <= 12 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {paybackMonths > 0 ? `${paybackMonths.toFixed(1)}mo` : '?'}
          </div>
          <div className="text-[10px] text-neutral-600">to recover CAC</div>
        </div>
      </div>

      {/* Supporting metrics */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        {margin && (
          <div>
            <div className="text-[10px] text-neutral-500">Gross Margin</div>
            <div className="text-sm text-neutral-200 font-mono">{margin}</div>
          </div>
        )}
        {revenue100 && (
          <div>
            <div className="text-[10px] text-neutral-500">Revenue @ 100 customers</div>
            <div className="text-sm text-neutral-200 font-mono">{revenue100}/mo</div>
          </div>
        )}
        {breakEven > 0 && (
          <div>
            <div className="text-[10px] text-neutral-500">Break-even</div>
            <div className="text-sm text-neutral-200 font-mono">{breakEven} customers</div>
          </div>
        )}
      </div>

      {reasoning && (
        <p className="text-[10px] text-neutral-600 mt-2">{reasoning}</p>
      )}

      {/* Health bar */}
      <div className="mt-4">
        <div className="flex justify-between text-[10px] text-neutral-600 mb-1">
          <span>0x (lose money)</span>
          <span>3x (healthy)</span>
          <span>5x+ (excellent)</span>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              ratio >= 5 ? 'bg-emerald-400' :
              ratio >= 3 ? 'bg-emerald-400/70' :
              ratio >= 2 ? 'bg-amber-400' :
              ratio >= 1 ? 'bg-orange-400' : 'bg-red-400'
            }`}
            style={{ width: `${Math.min(100, (ratio / 6) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
