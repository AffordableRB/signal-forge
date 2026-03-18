'use client';

import { OpportunityCandidate, Evidence } from '@/lib/types';

interface Props {
  candidate: OpportunityCandidate;
}

interface ProofDimension {
  id: string;
  label: string;
  question: string;
  signalType: string;
  color: string;
  bgColor: string;
}

const DIMENSIONS: ProofDimension[] = [
  {
    id: 'pain',
    label: 'Real Pain',
    question: 'Are people actually suffering from this problem?',
    signalType: 'pain',
    color: 'text-red-400',
    bgColor: 'bg-red-950/20 border-red-900/30',
  },
  {
    id: 'demand',
    label: 'Active Demand',
    question: 'Are people actively looking for a solution?',
    signalType: 'demand',
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/20 border-blue-900/30',
  },
  {
    id: 'money',
    label: 'Willingness to Pay',
    question: 'Is there proof people spend money on this?',
    signalType: 'money',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/20 border-emerald-900/30',
  },
  {
    id: 'competition',
    label: 'Beatable Competition',
    question: 'Are existing solutions weak or hated?',
    signalType: 'competition',
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/20 border-amber-900/30',
  },
];

function getStrengthLevel(count: number, sources: number): { label: string; color: string; width: string } {
  if (count >= 5 && sources >= 3) return { label: 'STRONG', color: 'text-emerald-400', width: 'w-full' };
  if (count >= 3 && sources >= 2) return { label: 'MODERATE', color: 'text-amber-400', width: 'w-3/4' };
  if (count >= 1) return { label: 'WEAK', color: 'text-orange-400', width: 'w-2/5' };
  return { label: 'NONE', color: 'text-red-400', width: 'w-0' };
}

function getTopEvidence(evidence: Evidence[], signalType: string, limit: number = 3): Evidence[] {
  return evidence
    .filter(e => e.signalType === signalType)
    .sort((a, b) => {
      // Tier 1 first, then by confidence
      const tierDiff = (a.sourceTier ?? 3) - (b.sourceTier ?? 3);
      if (tierDiff !== 0) return tierDiff;
      return (b.confidence ?? 0.5) - (a.confidence ?? 0.5);
    })
    .slice(0, limit);
}

export function ProofWall({ candidate: c }: Props) {
  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-300">Evidence Proof Wall</h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Real quotes from real sources proving each dimension of the opportunity
        </p>
      </div>

      <div className="divide-y divide-neutral-800/50">
        {DIMENSIONS.map(dim => {
          const allForType = c.evidence.filter(e => e.signalType === dim.signalType);
          const uniqueSources = new Set(allForType.map(e => e.source.split(':')[0])).size;
          const topEvidence = getTopEvidence(c.evidence, dim.signalType);
          const strength = getStrengthLevel(allForType.length, uniqueSources);

          return (
            <div key={dim.id} className="p-5">
              {/* Dimension header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className={`text-sm font-semibold ${dim.color}`}>{dim.label}</div>
                  <div className="text-xs text-neutral-500">{dim.question}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-bold ${strength.color}`}>{strength.label}</div>
                  <div className="text-[10px] text-neutral-600">
                    {allForType.length} signals, {uniqueSources} sources
                  </div>
                </div>
              </div>

              {/* Strength bar */}
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full ${strength.width} ${
                  strength.label === 'STRONG' ? 'bg-emerald-500' :
                  strength.label === 'MODERATE' ? 'bg-amber-500' :
                  strength.label === 'WEAK' ? 'bg-orange-500' : 'bg-red-500'
                } transition-all`} />
              </div>

              {/* Top evidence quotes */}
              {topEvidence.length > 0 ? (
                <div className="space-y-2">
                  {topEvidence.map((e, i) => (
                    <div key={i} className={`border rounded-lg p-3 ${dim.bgColor}`}>
                      <p className="text-sm text-neutral-300 leading-snug">
                        &ldquo;{e.excerpt.length > 250 ? e.excerpt.slice(0, 250) + '...' : e.excerpt}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-neutral-500">{e.source}</span>
                        {e.sourceTier && (
                          <span className={`text-[10px] px-1 py-0.5 rounded ${
                            e.sourceTier === 1 ? 'text-emerald-500 bg-emerald-950/40' :
                            e.sourceTier === 2 ? 'text-amber-500 bg-amber-950/40' :
                            'text-neutral-500 bg-neutral-900'
                          }`}>
                            Tier {e.sourceTier}
                          </span>
                        )}
                        {e.confidence != null && (
                          <span className="text-[10px] text-neutral-600">
                            {Math.round(e.confidence * 100)}% conf
                          </span>
                        )}
                        {e.url && e.url !== '#' && (
                          <a href={e.url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-blue-500 hover:text-blue-400">
                            source
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-neutral-600 italic p-3 bg-neutral-900/50 rounded">
                  No direct evidence found for this dimension. This is a gap in the analysis.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
