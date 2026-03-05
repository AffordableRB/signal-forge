export function StatusDot({ status }: { status: 'running' | 'completed' | 'failed' }) {
  const styles = {
    running: 'bg-amber-500 animate-pulse',
    completed: 'bg-emerald-500',
    failed: 'bg-red-500',
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${styles[status]}`} />
      <span className="text-sm capitalize">{status}</span>
    </span>
  );
}
