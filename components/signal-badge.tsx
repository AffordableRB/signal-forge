import { SignalType } from '@/lib/types';

const TYPE_STYLES: Record<SignalType, string> = {
  demand: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pain: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  money: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  competition: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

export function SignalBadge({ type }: { type: SignalType }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border uppercase tracking-wide ${TYPE_STYLES[type]}`}
    >
      {type}
    </span>
  );
}

export function TierBadge({ tier }: { tier?: 1 | 2 | 3 }) {
  if (!tier) return null;
  const styles = {
    1: 'bg-emerald-500/15 text-emerald-400',
    2: 'bg-amber-500/15 text-amber-400',
    3: 'bg-neutral-500/15 text-neutral-400',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-mono rounded ${styles[tier]}`}>
      T{tier}
    </span>
  );
}
