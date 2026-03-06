'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Competitor } from '@/lib/types';

interface Props {
  competitors: Competitor[];
}

function extractPrice(range?: string): number {
  if (!range) return 50;
  const match = range.match(/\$(\d+)/);
  return match ? parseInt(match[1]) : 50;
}

export function CompetitionChart({ competitors }: Props) {
  if (competitors.length === 0) {
    return (
      <div className="text-xs text-neutral-500 py-8 text-center">
        No competitor data available
      </div>
    );
  }

  const data = competitors.map(c => ({
    name: c.name,
    price: extractPrice(c.pricingRange),
    reviews: c.reviewScore ? Math.round(c.reviewScore * 20) : 10, // scale 0-5 to 0-100
    weaknesses: c.weaknesses.length,
    presence: Math.max(20, 100 - c.weaknesses.length * 15),
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="price"
            name="Price"
            unit="$"
            tick={{ fill: '#666', fontSize: 10 }}
            label={{ value: 'Price', position: 'bottom', fill: '#555', fontSize: 11 }}
          />
          <YAxis
            dataKey="reviews"
            name="Reviews"
            tick={{ fill: '#666', fontSize: 10 }}
            label={{ value: 'Review Score', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 11 }}
          />
          <ZAxis dataKey="presence" range={[100, 600]} name="Presence" />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#ccc' }}
          />
          <Scatter data={data} fill="#8b5cf6" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
