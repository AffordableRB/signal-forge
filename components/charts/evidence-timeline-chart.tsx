'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Evidence } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  demand: '#3b82f6',
  pain: '#f43f5e',
  money: '#10b981',
  competition: '#8b5cf6',
};

interface Props {
  evidence: Evidence[];
}

export function EvidenceTimelineChart({ evidence }: Props) {
  const withTimestamp = evidence.filter(e => e.timestamp);
  if (withTimestamp.length < 3) {
    return (
      <div className="text-xs text-neutral-500 py-8 text-center">
        Insufficient timestamped evidence for timeline chart
      </div>
    );
  }

  // Group by week
  const weekMap: Record<string, Record<string, number>> = {};

  for (const e of withTimestamp) {
    const date = new Date(e.timestamp!);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().slice(0, 10);

    if (!weekMap[key]) weekMap[key] = { demand: 0, pain: 0, money: 0, competition: 0 };
    weekMap[key][e.signalType] = (weekMap[key][e.signalType] ?? 0) + 1;
  }

  const data = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, counts]) => ({
      week: week.slice(5), // MM-DD
      ...counts,
    }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="week" tick={{ fill: '#666', fontSize: 10 }} />
          <YAxis tick={{ fill: '#666', fontSize: 10 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#ccc' }}
          />
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <Area
              key={type}
              type="monotone"
              dataKey={type}
              stackId="1"
              stroke={color}
              fill={color}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
