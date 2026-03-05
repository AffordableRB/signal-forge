import { RiskFlag } from '@/lib/types';

const SEVERITY_STYLES = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
};

export function RiskBadge({ flag }: { flag: RiskFlag }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${SEVERITY_STYLES[flag.severity]}`}
    >
      {flag.id}
    </span>
  );
}

export function RiskCount({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-emerald-500 text-sm">Clean</span>;
  }
  const color = count >= 3 ? 'text-red-400' : count >= 1 ? 'text-amber-400' : 'text-neutral-400';
  return <span className={`text-sm font-medium ${color}`}>{count} risk{count > 1 ? 's' : ''}</span>;
}
