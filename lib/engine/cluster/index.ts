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

function extractJobToBeDone(query: string): string {
  const normalized = normalizePhrase(query);

  // Strip noise words that come from template queries
  const cleaned = normalized
    .replace(/^(how to |best way to |need help with |looking for )/, '')
    .replace(/ (software|tool|app|solution|platform|reddit|problems|complaints|reviews|alternatives|pricing|competitors|challenges|difficulties|hiring|industry|trends|market|size|regulatory|compliance|invoicing|billing|payment|management|automation|small business|2024|2025)$/g, '')
    .replace(/ (software|problems|reddit|complaints|reviews|alternatives|pricing|competitors|challenges|difficulties) /g, ' ')
    .replace(/"([^"]+)"/g, '$1')
    .replace(/ or /gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If everything was stripped, fall back to first meaningful words
  if (cleaned.length < 5) {
    const words = normalized.split(' ').filter(w => !STOP_WORDS.has(w)).slice(0, 4);
    return words.join(' ') || normalized;
  }

  return cleaned;
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
  return {
    id: uuid(),
    vertical: group.vertical,
    jobToBeDone: group.jobToBeDone,
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
