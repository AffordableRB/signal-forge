// Shared signal classification logic for all collectors.

import { SignalType } from '../models/types';

const PAIN_PATTERNS = [
  /frustrat/i, /annoying/i, /broken/i, /terrible/i, /awful/i, /worst/i,
  /waste(s|d)?\s+(of\s+)?(time|hours|money)/i, /pain\s*point/i,
  /struggle/i, /nightmare/i, /hate\s+(using|this|it|the)/i,
  /doesn't\s+work/i, /doesn.t\s+work/i, /not\s+working/i,
  /bug(gy|s)/i, /crash(es|ing)/i, /slow\s+(as|and|loading)/i,
  /clunky/i, /outdated/i, /manual\s+(process|work|entry)/i,
  /hours\s+(every|each|per|a)\s+(week|day|month)/i,
  /sick\s+(of|and\s+tired)/i, /fed\s+up/i,
  /unreliable/i, /poor\s+(support|service|quality|ux|ui)/i,
];

const DEMAND_PATTERNS = [
  /any(one)?\s+(know|recommend|suggest|use)/i,
  /looking\s+for\s+(a|an|the|some)/i,
  /is\s+there\s+(a|an|any)/i,
  /need\s+(a|an|some|help)/i,
  /best\s+(tool|software|app|platform|solution)/i,
  /alternative(s)?\s+to/i,
  /recommend(ation)?s?\s+(for|please)/i,
  /what\s+(do\s+you|are\s+you|tool|software)\s+(use|using|recommend)/i,
  /software\s+for/i, /tool\s+for/i, /app\s+for/i,
  /automat(e|ion)\s+(for|my|the|this)/i,
  /wish\s+there\s+was/i, /does\s+anyone\s+have/i,
  /how\s+do\s+(you|i)\s+(handle|manage|deal)/i,
];

const MONEY_PATTERNS = [
  /\$\d+/i, /price\s*(hike|increase|raise|gouge)/i,
  /too\s+expensive/i, /overpriced/i, /cost(s|ing)\s+(too|a\s+lot)/i,
  /pricing/i, /budget/i, /afford/i, /pay(ing|ment)?/i,
  /subscription/i, /per\s+month/i, /\/mo\b/i,
  /free\s+(trial|plan|tier|version)/i, /roi/i,
  /billing/i, /invoice/i, /revenue/i,
  /worth\s+(the|it|paying)/i, /charge(s|d|ing)/i,
  /raised?\s+(the\s+)?price/i, /tripled/i, /doubled/i,
];

const COMPETITION_PATTERNS = [
  /competitor/i, /alternative/i, /switch(ed|ing)?\s+(from|to)/i,
  /vs\.?\s/i, /compared?\s+to/i, /better\s+than/i,
  /worse\s+than/i, /moving\s+(away|from)/i, /leaving/i,
  /cancel(led|ing)?\s+(my|our|the)/i,
  /used\s+to\s+use/i, /replaced/i, /migrat(e|ed|ing)/i,
  /market\s+(leader|share|dominat)/i,
];

export function classifySignal(text: string): SignalType {
  const scores = {
    pain: 0,
    demand: 0,
    money: 0,
    competition: 0,
  };

  for (const p of PAIN_PATTERNS) if (p.test(text)) scores.pain++;
  for (const p of DEMAND_PATTERNS) if (p.test(text)) scores.demand++;
  for (const p of MONEY_PATTERNS) if (p.test(text)) scores.money++;
  for (const p of COMPETITION_PATTERNS) if (p.test(text)) scores.competition++;

  const entries = Object.entries(scores) as [SignalType, number][];
  entries.sort((a, b) => b[1] - a[1]);

  // Default to demand if no patterns matched
  if (entries[0][1] === 0) return 'demand';
  return entries[0][0];
}

export function computeConfidence(text: string, baseMin: number, baseMax: number): number {
  // Longer, more specific text = higher confidence
  const lengthBoost = Math.min(text.length / 500, 0.15);
  const base = baseMin + Math.random() * (baseMax - baseMin);
  return Math.min(baseMax, Math.round((base + lengthBoost) * 100) / 100);
}
