// Scan mode configuration controlling depth and breadth of each pipeline phase.

export type ScanMode = 'quick' | 'standard' | 'deep' | 'thorough';

export type ScanPhase =
  | 'discovery'
  | 'deep-evidence'
  | 'market-mapping'
  | 'cross-validation'
  | 'analysis';

export interface PhaseConfig {
  id: ScanPhase;
  label: string;
  description: string;
}

export interface ScanModeConfig {
  mode: ScanMode;
  label: string;
  queryCount: number;           // how many seed queries to use
  subredditDepth: number;       // how many subreddits to search
  reviewSnippetLimit: number;   // max review snippets per source
  redditResultLimit: number;    // max reddit results per query
  pricingQueryCount: number;    // how many queries for pricing collector
  jobResultLimit: number;       // max job results extracted
  phases: ScanPhase[];          // which phases to run
  fastTimeoutMs: number;        // timeout for fast collectors
  proxyTimeoutMs: number;       // timeout for proxy collectors
}

export const PHASES: PhaseConfig[] = [
  { id: 'discovery',        label: 'Discovery',        description: 'Initial signal collection from all sources' },
  { id: 'deep-evidence',    label: 'Deep Evidence',    description: 'Expanded collection for top candidates' },
  { id: 'market-mapping',   label: 'Market Mapping',   description: 'Competitor and market structure analysis' },
  { id: 'cross-validation', label: 'Cross-Validation', description: 'Verify findings across independent sources' },
  { id: 'analysis',         label: 'Final Analysis',   description: 'Scoring, confidence, and synthesis' },
];

export const SCAN_MODES: Record<ScanMode, ScanModeConfig> = {
  quick: {
    mode: 'quick',
    label: 'Quick Scan',
    queryCount: 4,
    subredditDepth: 1,
    reviewSnippetLimit: 4,
    redditResultLimit: 10,
    pricingQueryCount: 1,
    jobResultLimit: 3,
    phases: ['discovery', 'analysis'],
    fastTimeoutMs: 10000,
    proxyTimeoutMs: 15000,
  },
  standard: {
    mode: 'standard',
    label: 'Standard Scan',
    queryCount: 6,
    subredditDepth: 2,
    reviewSnippetLimit: 8,
    redditResultLimit: 25,
    pricingQueryCount: 2,
    jobResultLimit: 5,
    phases: ['discovery', 'market-mapping', 'analysis'],
    fastTimeoutMs: 8000,
    proxyTimeoutMs: 12000,
  },
  deep: {
    mode: 'deep',
    label: 'Deep Scan',
    queryCount: 8,
    subredditDepth: 3,
    reviewSnippetLimit: 12,
    redditResultLimit: 30,
    pricingQueryCount: 2,
    jobResultLimit: 6,
    phases: ['discovery', 'deep-evidence', 'market-mapping', 'cross-validation', 'analysis'],
    fastTimeoutMs: 6000,
    proxyTimeoutMs: 10000,
  },
  thorough: {
    mode: 'thorough',
    label: 'Thorough Scan',
    queryCount: 12,
    subredditDepth: 5,
    reviewSnippetLimit: 20,
    redditResultLimit: 50,
    pricingQueryCount: 4,
    jobResultLimit: 10,
    phases: ['discovery', 'deep-evidence', 'market-mapping', 'cross-validation', 'analysis'],
    fastTimeoutMs: 30000,
    proxyTimeoutMs: 60000,
  },
};
