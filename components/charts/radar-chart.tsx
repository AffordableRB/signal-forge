'use client';

import {
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DetectorResult } from '@/lib/types';

const RADAR_DETECTORS = [
  { id: 'demand', label: 'Demand' },
  { id: 'painIntensity', label: 'Pain' },
  { id: 'abilityToPay', label: 'Pay' },
  { id: 'competitionWeakness', label: 'Comp Weakness' },
  { id: 'distributionAccess', label: 'Distribution' },
  { id: 'workflowAnchor', label: 'Workflow' },
  { id: 'marketTiming', label: 'Timing' },
];

interface Props {
  detectorResults: DetectorResult[];
}

export function OpportunityRadarChart({ detectorResults }: Props) {
  const data = RADAR_DETECTORS.map(d => {
    const result = detectorResults.find(r => r.detectorId === d.id);
    return {
      dimension: d.label,
      score: result?.score ?? 0,
      fullMark: 10,
    };
  });

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#333" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#999', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tick={{ fill: '#666', fontSize: 10 }}
            tickCount={6}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#ccc' }}
            itemStyle={{ color: '#34d399' }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#34d399"
            fill="#34d399"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}
