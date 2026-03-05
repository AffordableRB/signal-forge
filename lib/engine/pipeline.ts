// In-process pipeline runner for serverless environments (Vercel).
// Runs the same pipeline as the CLI but without file I/O or child processes.

import { OpportunityCandidate } from './models/types';
import { collectAllSignals } from './collectors';
import { clusterSignals } from './cluster';
import { analyzeAll } from './detectors';
import { scoreAll, rankCandidates } from './scoring';
import { applyFilters } from './filters';
import { applyKillSwitch } from './reality/kill-switch';
import { SEED_QUERIES } from './config/seed-queries';

export interface PipelineResult {
  candidates: OpportunityCandidate[];
  topScore: number;
  topOpportunity: string;
  candidateCount: number;
}

export async function runPipeline(): Promise<PipelineResult> {
  // 1. Collect
  const signals = await collectAllSignals(SEED_QUERIES);

  // 2. Cluster
  const candidates = clusterSignals(signals);

  // 3. Analyze
  const analyzed = analyzeAll(candidates);

  // 4. Score
  const scored = scoreAll(analyzed);

  // 5. Filter + kill switch
  const filtered = applyKillSwitch(applyFilters(scored));

  // 6. Rank
  const ranked = rankCandidates(filtered);

  const accepted = ranked.filter(c => !c.rejected);

  return {
    candidates: ranked,
    topScore: accepted[0]?.scores.final ?? 0,
    topOpportunity: accepted[0]?.jobToBeDone ?? 'N/A',
    candidateCount: ranked.length,
  };
}
