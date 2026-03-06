'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Evidence } from '@/lib/types';

const SOURCE_COLORS: Record<string, string> = {
  Reviews: '#f59e0b',
  Jobs: '#3b82f6',
  Pricing: '#10b981',
  Reddit: '#f97316',
  Trends: '#8b5cf6',
  Autocomplete: '#6b7280',
  'Product Hunt': '#ec4899',
  Other: '#525252',
};

const SOURCE_WEIGHTS: Record<string, number> = {
  Pricing: 1.0,
  Reviews: 0.9,
  Jobs: 0.8,
  Reddit: 0.6,
  Trends: 0.4,
  Autocomplete: 0.25,
  'Product Hunt': 0.2,
  Other: 0.5,
};

function classifySource(source: string): string {
  const l = source.toLowerCase();
  if (l.includes('g2') || l.includes('capterra') || l.includes('trustpilot') || l.includes('review')) return 'Reviews';
  if (l.includes('indeed') || l.includes('job') || l.includes('upwork')) return 'Jobs';
  if (l.includes('pricing') || l.includes('price')) return 'Pricing';
  if (l.includes('reddit')) return 'Reddit';
  if (l.includes('trend')) return 'Trends';
  if (l.includes('autocomplete') || l.includes('suggest') || l.includes('search-intent')) return 'Autocomplete';
  if (l.includes('product hunt') || l.includes('producthunt')) return 'Product Hunt';
  return 'Other';
}

interface Props {
  evidence: Evidence[];
}

export function SignalSourceChart({ evidence }: Props) {
  const counts: Record<string, { raw: number; weighted: number }> = {};

  for (const e of evidence) {
    const src = classifySource(e.source);
    if (!counts[src]) counts[src] = { raw: 0, weighted: 0 };
    counts[src].raw += 1;
    counts[src].weighted += (e.confidence ?? 0.5) * (SOURCE_WEIGHTS[src] ?? 0.5);
  }

  const data = Object.entries(counts)
    .map(([name, { raw, weighted }]) => ({
      name,
      signals: raw,
      weighted: Math.round(weighted * 10) / 10,
    }))
    .sort((a, b) => b.weighted - a.weighted);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} />
          <YAxis
            dataKey="name"
            type="category"
            width={90}
            tick={{ fill: '#999', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#ccc' }}
          />
          <Bar dataKey="signals" name="Raw Count" radius={[0, 4, 4, 0]} opacity={0.3}>
            {data.map(d => (
              <Cell key={d.name} fill={SOURCE_COLORS[d.name] ?? '#525252'} />
            ))}
          </Bar>
          <Bar dataKey="weighted" name="Weighted Score" radius={[0, 4, 4, 0]}>
            {data.map(d => (
              <Cell key={d.name} fill={SOURCE_COLORS[d.name] ?? '#525252'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
