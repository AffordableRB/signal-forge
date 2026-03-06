'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

function formatName(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

function getColor(value: number): string {
  if (value >= 70) return '#34d399';
  if (value >= 50) return '#fbbf24';
  return '#f87171';
}

interface Props {
  detectorConfidence: Record<string, number>;
}

export function ConfidenceBreakdownChart({ detectorConfidence }: Props) {
  const data = Object.entries(detectorConfidence)
    .map(([id, confidence]) => ({
      name: formatName(id),
      confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: '#666', fontSize: 10 }}
            tickFormatter={v => `${v}%`}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={120}
            tick={{ fill: '#999', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#ccc' }}
          />
          <ReferenceLine x={50} stroke="#444" strokeDasharray="3 3" />
          <Bar dataKey="confidence" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={getColor(d.confidence)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
