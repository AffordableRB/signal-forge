import { v4 as uuid } from 'uuid';
import { RawSignal, OpportunityCandidate, Evidence } from '../models/types';

const STOP_WORDS = new Set([
  'ai', 'software', 'tool', 'platform', 'solution', 'app', 'system',
  'best', 'top', 'free', 'new', 'online', 'digital', 'smart', 'modern',
  'the', 'a', 'an', 'for', 'and', 'or', 'to', 'of', 'in', 'with',
]);

interface SignalGroup {
  key: string;
  vertical: string;
  jobToBeDone: string;
  targetBuyer: string;
  triggerMoment: string;
  signals: RawSignal[];
  evidence: Evidence[];
}

export function clusterSignals(signals: RawSignal[]): OpportunityCandidate[] {
  const groups = groupByMultiDimension(signals);
  return groups.map(group => candidateFromGroup(group));
}

function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizePhrase(text)
      .split(' ')
      .filter(t => t.length > 0 && !STOP_WORDS.has(t))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set(Array.from(a).filter(x => b.has(x)));
  const union = new Set(Array.from(a).concat(Array.from(b)));
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Noise words that appear in search queries but aren't part of the actual opportunity
const QUERY_NOISE = new Set([
  'software', 'tool', 'app', 'solution', 'platform', 'system', 'service',
  'reddit', 'problems', 'complaints', 'reviews', 'alternatives', 'pricing',
  'competitors', 'challenges', 'difficulties', 'hiring', 'industry', 'trends',
  'market', 'size', 'regulatory', 'compliance', 'automation', 'management',
  'nightmare', 'expensive', 'frustrations', 'manual', 'process', 'issues',
  'work', 'costs', 'burden', 'too', 'high', 'low', 'bad', 'worst',
  'looking', 'need', 'want', 'help', 'best', 'top', 'cheap', 'free',
  '2024', '2025', '2026', 'small', 'business', 'site', 'com',
]);

function extractJobToBeDone(query: string): string {
  // Remove URL fragments like site:reddit.com (before and after normalization)
  const cleaned = query
    .replace(/site\s*:\s*\S+/gi, '')
    .replace(/sitereddit\S*/gi, '')
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .trim();
  const norm = normalizePhrase(cleaned)
    .replace(/siteredditcom\S*/g, '')
    .replace(/^(how to |best way to |need help with |looking for |reddit )/g, '')
    .replace(/"([^"]+)"/g, '$1')
    .replace(/ or /gi, ' ');

  // Split into words, keep only meaningful ones
  const words = norm.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w) && !QUERY_NOISE.has(w));

  // Take up to 5 meaningful words
  const result = words.slice(0, 5).join(' ').trim();

  if (result.length < 4) {
    // Fallback: take first 4 non-stop words from original
    const fallback = normalizePhrase(query).split(' ').filter(w => !STOP_WORDS.has(w)).slice(0, 4);
    return fallback.join(' ') || normalizePhrase(query);
  }

  return result;
}

// Try to derive a better opportunity name from evidence excerpts
function refineJobName(name: string, evidence: Evidence[]): string {
  if (evidence.length < 2) return name;

  // Count domain-specific nouns in evidence excerpts
  const wordFreq = new Map<string, number>();
  for (const e of evidence.slice(0, 20)) {
    const words = normalizePhrase(e.excerpt || '')
      .split(' ')
      .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !QUERY_NOISE.has(w));
    for (const w of words) {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }
  }

  // Find the most frequent domain words that overlap with the current name
  const nameWords = new Set(name.split(' '));
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(e => e[0]);

  // If we have strong evidence words that overlap with the name, keep it
  const hasOverlap = topWords.some(w => nameWords.has(w));
  if (hasOverlap) return name;

  // Otherwise, try to build a better name from top evidence words + name words
  const combined = Array.from(nameWords).filter(w => w.length > 3);
  if (combined.length >= 2) return combined.slice(0, 4).join(' ');

  return name;
}

function inferVertical(query: string): string {
  const q = query.toLowerCase();
  const verticals: Record<string, string[]> = {
    'home-services': ['plumber', 'hvac', 'roofing', 'contractor', 'home service', 'landscap', 'electrician', 'handyman'],
    'healthcare': ['clinic', 'dental', 'medical', 'patient', 'health', 'doctor', 'therapy'],
    'legal': ['lawyer', 'attorney', 'legal', 'law firm'],
    'real-estate': ['real estate', 'property', 'rental', 'landlord', 'realtor'],
    'ecommerce': ['ecommerce', 'shopify', 'online store', 'dropship'],
    'saas': ['saas', 'b2b', 'software', 'api'],
    'finance': ['accounting', 'bookkeep', 'invoice', 'payment', 'fintech'],
    'education': ['course', 'tutoring', 'education', 'training', 'learning'],
    'recruitment': ['hiring', 'recruit', 'resume', 'job board', 'talent'],
    'pet-care': ['pet', 'veterinar', 'vet ', 'grooming', 'dog', 'cat', 'animal', 'kennel', 'boarding', 'pet care'],
    'fitness': ['fitness', 'gym', 'workout', 'personal train', 'coach', 'yoga', 'crossfit'],
    'restaurant': ['restaurant', 'food', 'catering', 'kitchen', 'chef', 'dining', 'bar '],
    'construction': ['construction', 'building', 'general contractor', 'subcontract', 'remodel'],
    'automotive': ['auto', 'car ', 'mechanic', 'dealership', 'vehicle', 'fleet'],
    'beauty': ['salon', 'beauty', 'spa ', 'barber', 'nail', 'hair', 'cosmetic'],
    'logistics': ['shipping', 'logistics', 'freight', 'warehouse', 'delivery', 'supply chain'],
    'agriculture': ['farm', 'agriculture', 'crop', 'livestock', 'ranch'],
  };

  for (const [vertical, keywords] of Object.entries(verticals)) {
    if (keywords.some(k => q.includes(k))) return vertical;
  }
  return 'general';
}

function inferBuyer(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('small business') || q.includes('smb')) return 'Small business owner';
  if (q.includes('enterprise')) return 'Enterprise buyer';
  if (q.includes('freelance') || q.includes('solopreneur')) return 'Freelancer / Solopreneur';
  if (q.includes('agency')) return 'Agency owner';
  if (q.includes('startup')) return 'Startup founder';
  return 'Small business owner';
}

function inferTrigger(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('miss') || q.includes('lost')) return 'Lost revenue event';
  if (q.includes('churn') || q.includes('cancel')) return 'Customer churn event';
  if (q.includes('hire') || q.includes('onboard')) return 'Growth / hiring trigger';
  if (q.includes('compliance') || q.includes('regulation')) return 'Regulatory change';
  if (q.includes('season') || q.includes('busy')) return 'Seasonal demand spike';
  return 'Operational inefficiency realization';
}

interface DimensionMatch {
  jobSimilarity: number;
  sameBuyer: boolean;
  sameVertical: boolean;
  sameTrigger: boolean;
}

function dimensionMatch(
  signal: { job: string; buyer: string; vertical: string; trigger: string },
  group: SignalGroup
): DimensionMatch {
  const jobTokens = tokenize(signal.job);
  const groupTokens = tokenize(group.jobToBeDone);
  return {
    jobSimilarity: jaccardSimilarity(jobTokens, groupTokens),
    sameBuyer: signal.buyer === group.targetBuyer,
    sameVertical: signal.vertical === group.vertical,
    sameTrigger: signal.trigger === group.triggerMoment,
  };
}

function shouldMerge(match: DimensionMatch): boolean {
  // High similarity jobs always merge
  if (match.jobSimilarity >= 0.5) return true;

  // Medium similarity + at least one other matching dimension
  if (match.jobSimilarity < 0.2) return false;

  let matchingDimensions = 0;
  if (match.jobSimilarity >= 0.2) matchingDimensions++;
  if (match.sameBuyer) matchingDimensions++;
  if (match.sameVertical) matchingDimensions++;
  if (match.sameTrigger) matchingDimensions++;

  return matchingDimensions >= 2;
}

function groupByMultiDimension(signals: RawSignal[]): SignalGroup[] {
  const groups: SignalGroup[] = [];

  for (const signal of signals) {
    const job = extractJobToBeDone(signal.query);
    const buyer = inferBuyer(signal.query);
    const vertical = inferVertical(signal.query);
    const trigger = inferTrigger(signal.query);

    let merged = false;
    for (const group of groups) {
      const match = dimensionMatch({ job, buyer, vertical, trigger }, group);
      if (shouldMerge(match)) {
        group.signals.push(signal);
        group.evidence.push(...signal.evidence);
        merged = true;
        break;
      }
    }

    if (!merged) {
      groups.push({
        key: normalizePhrase(job),
        vertical,
        jobToBeDone: job,
        targetBuyer: buyer,
        triggerMoment: trigger,
        signals: [signal],
        evidence: [...signal.evidence],
      });
    }
  }

  // TODO: Add embedding-based clustering for semantic similarity

  return groups;
}

function candidateFromGroup(group: SignalGroup): OpportunityCandidate {
  // Refine the job name using evidence context
  const refinedName = refineJobName(group.jobToBeDone, group.evidence);

  return {
    id: uuid(),
    vertical: group.vertical,
    jobToBeDone: refinedName,
    targetBuyer: group.targetBuyer,
    triggerMoment: group.triggerMoment,
    evidence: group.evidence,
    competitors: [],
    rawSignals: group.signals,
    detectorResults: [],
    scores: { final: 0, breakdown: {} },
    rejected: false,
    rejectionReasons: [],
    riskFlags: [],
  };
}
