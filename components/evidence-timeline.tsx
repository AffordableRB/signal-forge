'use client';

import { Evidence } from '@/lib/types';
import { SignalBadge, TierBadge } from './signal-badge';

interface TimelineProps {
  evidence: Evidence[];
}

interface GroupedEvidence {
  label: string;
  items: Evidence[];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupByDate(evidence: Evidence[]): GroupedEvidence[] {
  const groups = new Map<string, Evidence[]>();

  // Sort by timestamp descending, unknown last
  const sorted = [...evidence].sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return b.timestamp - a.timestamp;
  });

  for (const e of sorted) {
    const label = e.timestamp ? formatDate(e.timestamp) : 'Unknown date';
    const list = groups.get(label) ?? [];
    list.push(e);
    groups.set(label, list);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function computeMomentum(evidence: Evidence[]): { last7d: number; last30d: number } | null {
  const now = Date.now();
  const withTs = evidence.filter(e => e.timestamp != null);
  if (withTs.length === 0) return null;

  const last7d = withTs.filter(e => now - e.timestamp! < 7 * 86400000).length;
  const last30d = withTs.filter(e => now - e.timestamp! < 30 * 86400000).length;
  return { last7d, last30d };
}

export function EvidenceTimeline({ evidence }: TimelineProps) {
  const groups = groupByDate(evidence);
  const momentum = computeMomentum(evidence);

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-300">Evidence Timeline</h3>
        {momentum && (
          <span className="text-xs text-neutral-500">
            {momentum.last7d} signal{momentum.last7d !== 1 ? 's' : ''} in last 7d
            {' \u00B7 '}
            {momentum.last30d} in last 30d
          </span>
        )}
      </div>

      <div className="divide-y divide-neutral-800/50">
        {groups.map(group => (
          <div key={group.label}>
            <div className="px-5 py-2 bg-neutral-900/50">
              <span className="text-xs font-medium text-neutral-500">{group.label}</span>
            </div>
            {group.items.map((e, i) => (
              <div key={i} className="px-5 py-3 flex gap-3">
                <div className="w-1 rounded-full bg-neutral-800 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <SignalBadge type={e.signalType} />
                    <TierBadge tier={e.sourceTier} />
                    {e.confidence != null && (
                      <span className="text-xs text-neutral-600 font-mono">
                        {(e.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="text-xs text-neutral-600 ml-auto truncate">
                      {e.source}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {e.excerpt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
