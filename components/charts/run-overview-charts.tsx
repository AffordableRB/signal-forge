'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { OpportunityCandidate } from '@/lib/types';

const COLORS = {
  emerald: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
  blue: '#60a5fa',
  purple: '#a78bfa',
  neutral: '#737373',
};

const OCEAN_COLORS: Record<string, string> = {
  blue: COLORS.blue,
  purple: COLORS.purple,
  red: COLORS.red,
};

// ─── Score Distribution Bar Chart ───────────────────────────────────

export function ScoreDistributionChart({ candidates }: { candidates: OpportunityCandidate[] }) {
  const data = candidates
    .filter(c => !c.rejected)
    .sort((a, b) => b.scores.final - a.scores.final)
    .slice(0, 10)
    .map(c => ({
      name: c.jobToBeDone.length > 30 ? c.jobToBeDone.slice(0, 28) + '...' : c.jobToBeDone,
      score: Number(c.scores.final.toFixed(1)),
      color: c.scores.final >= 6 ? COLORS.emerald : c.scores.final >= 4 ? COLORS.amber : COLORS.red,
    }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" domain={[0, 10]} tick={{ fill: '#737373', fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={180} tick={{ fill: '#a3a3a3', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#e5e5e5' }}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Market Type Pie Chart ──────────────────────────────────────────

export function MarketTypePieChart({ candidates }: { candidates: OpportunityCandidate[] }) {
  const counts: Record<string, number> = { blue: 0, purple: 0, red: 0 };
  for (const c of candidates.filter(c => !c.rejected)) {
    const type = c.marketStructure?.type ?? 'purple';
    counts[type] = (counts[type] || 0) + 1;
  }

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name + ' ocean', value, fill: OCEAN_COLORS[name] }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          dataKey="value"
          label={({ name, value }) => `${name} (${value})`}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 8, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Detector Averages Radar ────────────────────────────────────────

export function DetectorAveragesRadar({ candidates }: { candidates: OpportunityCandidate[] }) {
  const accepted = candidates.filter(c => !c.rejected);
  if (accepted.length === 0) return null;

  const detectorIds = new Set<string>();
  for (const c of accepted) {
    for (const dr of c.detectorResults) {
      detectorIds.add(dr.detectorId);
    }
  }

  const data = Array.from(detectorIds).map(id => {
    const scores = accepted
      .map(c => c.detectorResults.find(dr => dr.detectorId === id)?.score ?? 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return {
      detector: id.replace(/([A-Z])/g, ' $1').trim(),
      average: Number(avg.toFixed(1)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#404040" />
        <PolarAngleAxis dataKey="detector" tick={{ fill: '#a3a3a3', fontSize: 9 }} />
        <PolarRadiusAxis domain={[0, 10]} tick={{ fill: '#737373', fontSize: 9 }} />
        <Radar dataKey="average" stroke={COLORS.emerald} fill={COLORS.emerald} fillOpacity={0.2} />
        <Tooltip
          contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 8, fontSize: 12 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Score vs Confidence Scatter ────────────────────────────────────

export function ScoreVsConfidenceChart({ candidates }: { candidates: OpportunityCandidate[] }) {
  const data = candidates
    .filter(c => !c.rejected && c.confidence)
    .map(c => ({
      name: c.jobToBeDone,
      score: c.scores.final,
      confidence: c.confidence!.overall,
      evidence: c.evidence.length,
      market: c.marketStructure?.type ?? 'purple',
    }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
        <XAxis
          type="number"
          dataKey="score"
          name="Score"
          domain={[0, 10]}
          tick={{ fill: '#737373', fontSize: 11 }}
          label={{ value: 'Score', position: 'bottom', fill: '#525252', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="confidence"
          name="Confidence"
          domain={[0, 100]}
          tick={{ fill: '#737373', fontSize: 11 }}
          label={{ value: 'Confidence %', angle: -90, position: 'insideLeft', fill: '#525252', fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="evidence" range={[40, 400]} name="Evidence" />
        <Tooltip
          contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 8, fontSize: 12 }}
        />
        <Scatter data={data}>
          {data.map((entry, i) => (
            <Cell key={i} fill={OCEAN_COLORS[entry.market] ?? COLORS.neutral} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── Evidence by Signal Type ────────────────────────────────────────

export function EvidenceBreakdownChart({ candidates }: { candidates: OpportunityCandidate[] }) {
  const counts: Record<string, number> = { demand: 0, pain: 0, money: 0, competition: 0 };
  for (const c of candidates.filter(c => !c.rejected)) {
    for (const e of c.evidence) {
      counts[e.signalType] = (counts[e.signalType] || 0) + 1;
    }
  }

  const SIGNAL_COLORS: Record<string, string> = {
    demand: COLORS.blue,
    pain: COLORS.red,
    money: COLORS.emerald,
    competition: COLORS.amber,
  };

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, fill: SIGNAL_COLORS[name] ?? COLORS.neutral }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 0, right: 20 }}>
        <XAxis dataKey="name" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
        <YAxis tick={{ fill: '#737373', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
