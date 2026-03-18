'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Label, ReferenceArea,
} from 'recharts';
import { OpportunityCandidate } from '@/lib/types';

interface Props {
  candidate: OpportunityCandidate;
}

interface CompetitorPoint {
  name: string;
  price: number;
  quality: number;
  isYou: boolean;
}

function extractPrice(pricingRange?: string): number {
  if (!pricingRange) return 100;
  // Extract numbers from pricing range like "$50-200/mo" or "$299/mo"
  const matches = pricingRange.match(/\$(\d+)/g);
  if (!matches || matches.length === 0) return 100;
  const prices = matches.map(m => parseInt(m.replace('$', ''), 10)).filter(p => p > 0);
  if (prices.length === 0) return 100;
  // Use midpoint
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

function estimateQuality(weaknesses: string[], reviewScore?: number): number {
  if (reviewScore) return reviewScore * 2; // Convert 5-star to 0-10
  // More weaknesses = lower quality
  const weaknessCount = weaknesses.length;
  if (weaknessCount >= 3) return 3;
  if (weaknessCount >= 2) return 4.5;
  if (weaknessCount >= 1) return 6;
  return 7;
}

export function CompetitivePositionChart({ candidate: c }: Props) {
  if (c.competitors.length === 0) return null;

  const mkt = c.marketSize;
  const compScore = c.detectorResults.find(r => r.detectorId === 'competitionWeakness')?.score ?? 5;

  // Plot competitors
  const competitors: CompetitorPoint[] = c.competitors.map(comp => ({
    name: comp.name,
    price: extractPrice(comp.pricingRange),
    quality: estimateQuality(comp.weaknesses, comp.reviewScore),
    isYou: false,
  }));

  // Plot "Your Opportunity" in the gap
  const avgCompPrice = competitors.reduce((s, c) => s + c.price, 0) / competitors.length;
  const avgCompQuality = competitors.reduce((s, c) => s + c.quality, 0) / competitors.length;

  // Position yourself: lower price if competitors are expensive, higher quality
  const yourPrice = mkt?.avgMonthlyPrice ?? Math.round(avgCompPrice * 0.6);
  const yourQuality = Math.min(10, avgCompQuality + (compScore * 0.3));

  competitors.push({
    name: 'YOUR OPPORTUNITY',
    price: yourPrice,
    quality: yourQuality,
    isYou: true,
  });

  // Calculate the opportunity zone bounds
  const maxPrice = Math.max(...competitors.map(c => c.price)) * 1.2;

  return (
    <div className="border border-neutral-800 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-neutral-300 mb-1">Competitive Positioning</h3>
      <p className="text-xs text-neutral-500 mb-4">
        Where the gap is: lower price, higher quality than incumbents
      </p>
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis
              type="number"
              dataKey="quality"
              domain={[0, 10]}
              tick={{ fill: '#666', fontSize: 11 }}
              tickCount={6}
            >
              <Label value="Quality / Customer Satisfaction" position="bottom" offset={0} style={{ fill: '#555', fontSize: 11 }} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="price"
              domain={[0, Math.ceil(maxPrice / 50) * 50]}
              tick={{ fill: '#666', fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            >
              <Label value="Price ($/mo)" angle={-90} position="insideLeft" offset={10} style={{ fill: '#555', fontSize: 11 }} />
            </YAxis>
            {/* Opportunity zone highlight */}
            <ReferenceArea
              x1={yourQuality - 1}
              x2={yourQuality + 1}
              y1={Math.max(0, yourPrice - avgCompPrice * 0.2)}
              y2={yourPrice + avgCompPrice * 0.2}
              fill="#34d399"
              fillOpacity={0.08}
              stroke="#34d399"
              strokeOpacity={0.3}
              strokeDasharray="4 4"
            />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              formatter={(value?: number, name?: string) => {
                if (value == null) return ['', name ?? ''];
                if (name === 'price') return [`$${value}/mo`, 'Price'];
                if (name === 'quality') return [`${value.toFixed(1)}/10`, 'Quality'];
                return [value, name ?? ''];
              }}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload as CompetitorPoint | undefined;
                return item?.name ?? '';
              }}
            />
            <Scatter data={competitors} shape="circle">
              {competitors.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isYou ? '#34d399' : '#ef4444'}
                  stroke={entry.isYou ? '#34d399' : '#ef4444'}
                  strokeWidth={entry.isYou ? 3 : 1}
                  r={entry.isYou ? 8 : 5}
                  fillOpacity={entry.isYou ? 0.8 : 0.5}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3">
        {competitors.map((comp, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${comp.isYou ? 'bg-emerald-400' : 'bg-red-400/50'}`} />
            <span className={comp.isYou ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
              {comp.name}
              <span className="text-neutral-600 ml-1">${comp.price}/mo</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
