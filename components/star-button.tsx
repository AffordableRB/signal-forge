'use client';

import { useState } from 'react';
import { OpportunityCandidate } from '@/lib/types';
import { opportunityKey } from '@/lib/opportunity-key';

interface StarButtonProps {
  candidate: OpportunityCandidate;
  runId: string;
  initialWatched?: boolean;
  size?: 'sm' | 'md';
}

export function StarButton({ candidate, runId, initialWatched = false, size = 'sm' }: StarButtonProps) {
  const [watched, setWatched] = useState(initialWatched);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch('/api/watchlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityKey: opportunityKey(candidate),
          runId,
          opportunitySnapshot: candidate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWatched(data.watched);
      }
    } finally {
      setLoading(false);
    }
  }

  const sizeClass = size === 'md' ? 'w-6 h-6' : 'w-4 h-4';

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`${sizeClass} shrink-0 transition-colors disabled:opacity-50`}
      title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {watched ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-neutral-600 hover:text-amber-400">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
    </button>
  );
}
