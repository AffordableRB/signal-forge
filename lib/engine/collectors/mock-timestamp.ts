// Generate realistic timestamps spread over the last 30-90 days for mock data.
// Uses a deterministic seed from the query string so results are stable across runs.
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function mockTimestamps(query: string, count: number): number[] {
  const now = Date.now();
  const seed = hashCode(query);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    // Spread between 2 and 85 days ago, deterministic per query+index
    const daysAgo = 2 + ((seed * (i + 1) * 7) % 83);
    const jitter = ((seed * (i + 3)) % 86400) * 1000; // sub-day jitter
    result.push(now - daysAgo * 86400000 - jitter);
  }
  return result.sort((a, b) => b - a); // newest first
}
