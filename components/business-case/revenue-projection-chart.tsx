'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { OpportunityCandidate } from '@/lib/types';

interface Props {
  candidate: OpportunityCandidate;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

export function RevenueProjectionChart({ candidate: c }: Props) {
  const mkt = c.marketSize;
  if (!mkt) return null;

  const price = mkt.avgMonthlyPrice;
  const totalAddressable = mkt.potentialCustomers;

  // Monthly customer acquisition rate based on distribution and ease scores
  const distScore = c.detectorResults.find(r => r.detectorId === 'distributionAccess')?.score ?? 5;
  const easeScore = c.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 5;

  // Base monthly acquisition: 3-15 customers depending on distribution
  const baseMonthlyAcq = Math.max(3, Math.round(distScore * 1.5));

  // Churn rate estimate
  const workflowScore = c.detectorResults.find(r => r.detectorId === 'workflowAnchor')?.score ?? 5;
  const monthlyChurn = Math.max(0.02, 0.10 - (workflowScore * 0.01));

  // Growth multiplier (compounds as word-of-mouth kicks in)
  const growthRate = 1.08 + (distScore * 0.01); // 1.13x to 1.18x monthly growth

  // Fixed costs estimate (solo founder)
  const fixedCosts = 500; // hosting, tools, basic ops

  // Build 12-month projections for 3 scenarios
  const data = [];
  let custCons = 0, custBase = 0, custAgg = 0;

  for (let month = 1; month <= 12; month++) {
    // Month 1-2: building MVP (minimal customers if easy to build)
    const buildDelay = easeScore >= 7 ? 1 : easeScore >= 5 ? 2 : 3;
    const isLive = month > buildDelay;

    if (isLive) {
      const monthsSinceLaunch = month - buildDelay;
      const growthMultiplier = Math.pow(growthRate, monthsSinceLaunch - 1);

      // Conservative: 50% of base acquisition, 1.5x churn
      const newCons = Math.round(baseMonthlyAcq * 0.5 * growthMultiplier);
      const churnedCons = Math.round(custCons * monthlyChurn * 1.5);
      custCons = Math.min(totalAddressable, custCons + newCons - churnedCons);

      // Base: standard acquisition
      const newBase = Math.round(baseMonthlyAcq * growthMultiplier);
      const churnedBase = Math.round(custBase * monthlyChurn);
      custBase = Math.min(totalAddressable, custBase + newBase - churnedBase);

      // Aggressive: 2x acquisition, 0.7x churn
      const newAgg = Math.round(baseMonthlyAcq * 2 * growthMultiplier);
      const churnedAgg = Math.round(custAgg * monthlyChurn * 0.7);
      custAgg = Math.min(totalAddressable, custAgg + newAgg - churnedAgg);
    }

    data.push({
      month: `M${month}`,
      conservative: Math.round(custCons * price),
      base: Math.round(custBase * price),
      aggressive: Math.round(custAgg * price),
      breakEven: fixedCosts,
      custBase,
    });
  }

  // Find break-even month
  const breakEvenMonth = data.findIndex(d => d.base > fixedCosts) + 1;
  const month12Rev = data[11]?.base ?? 0;
  const month12Cust = data[11]?.custBase ?? 0;

  return (
    <div className="border border-neutral-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-300">12-Month Revenue Projection</h3>
        <div className="flex gap-4 text-xs text-neutral-500">
          {breakEvenMonth > 0 && breakEvenMonth <= 12 && (
            <span>Break-even: <span className="text-emerald-400 font-mono">Month {breakEvenMonth}</span></span>
          )}
          <span>Month 12: <span className="text-emerald-400 font-mono">{formatCurrency(month12Rev)}/mo</span></span>
          <span>Customers: <span className="text-blue-400 font-mono">{month12Cust}</span></span>
        </div>
      </div>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#666', fontSize: 11 }}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#ccc' }}
              formatter={(value?: number, name?: string) => [
                formatCurrency(value ?? 0) + '/mo',
                name === 'conservative' ? 'Conservative' :
                name === 'base' ? 'Base Case' :
                name === 'aggressive' ? 'Aggressive' : (name ?? ''),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) =>
                value === 'conservative' ? 'Conservative' :
                value === 'base' ? 'Base Case' :
                value === 'aggressive' ? 'Aggressive' : value
              }
            />
            <ReferenceLine
              y={fixedCosts}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={1}
              label={{ value: 'Break-even', position: 'right', fill: '#ef4444', fontSize: 10 }}
            />
            <Line type="monotone" dataKey="conservative" stroke="#666" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="base" stroke="#34d399" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="aggressive" stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 text-[10px] text-neutral-600">
        Based on ${price}/mo pricing, {baseMonthlyAcq} new customers/mo base acquisition,
        {(monthlyChurn * 100).toFixed(1)}% monthly churn.
        Assumes {Math.round((growthRate - 1) * 100)}% monthly growth from word-of-mouth.
      </div>
    </div>
  );
}
