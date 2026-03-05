'use client';

import { OpportunityCandidate } from '@/lib/types';
import { generateWhyThisExists } from '@/lib/why-this-exists';

export function WhyThisExists({ candidate }: { candidate: OpportunityCandidate }) {
  const bullets = generateWhyThisExists(candidate);

  if (bullets.length === 0) return null;

  return (
    <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-emerald-400 mb-3">
        Why This Exists
      </h3>
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex gap-2 text-sm text-neutral-300">
            <span className="text-emerald-600 shrink-0 mt-0.5">&bull;</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
