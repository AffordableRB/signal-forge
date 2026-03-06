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

function extractJobToBeDone(query: string, evidence: Evidence[]): string {
  // Try to extract a meaningful job-to-be-done from evidence excerpts
  // rather than just using the search query
  if (evidence.length > 0) {
    // Look for pain-point patterns in evidence
    const painPatterns = [
      /(?:need|want|looking for|wish there was|struggle with|problem with|frustrated with|tired of|hard to|difficult to|can't find|no good)\s+(.{10,60})/i,
      /(?:how do I|how to|best way to)\s+(.{10,60})/i,
    ];

    for (const e of evidence.slice(0, 5)) {
      for (const pattern of painPatterns) {
        const match = e.excerpt.match(pattern);
        if (match) {
          const extracted = match[1]
            .replace(/[.!?,;]+$/, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
          if (extracted.length >= 10 && extracted.length <= 80) {
            return extracted;
          }
        }
      }
    }

    // If no pain pattern found, use the most information-dense excerpt
    const bestExcerpt = evidence
      .filter(e => e.excerpt.length > 30)
      .sort((a, b) => {
        // Prefer pain/demand signals
        const aScore = (a.signalType === 'pain' ? 2 : a.signalType === 'demand' ? 1 : 0);
        const bScore = (b.signalType === 'pain' ? 2 : b.signalType === 'demand' ? 1 : 0);
        return bScore - aScore;
      })[0];

    if (bestExcerpt) {
      // Extract a short summary from the excerpt
      const words = bestExcerpt.excerpt.split(/\s+/).slice(0, 10).join(' ');
      const cleaned = words.replace(/[.!?,;:]+$/, '').toLowerCase().trim();
      if (cleaned.length >= 10) return cleaned;
    }
  }

  // Fallback: clean up the query
  const normalized = normalizePhrase(query);
  return normalized
    .replace(/^(how to |best way to |need help with |looking for )/, '')
    .replace(/( software| tool| app| solution| platform| reddit| problems| complaints| reviews| alternatives| pricing| competitors)$/g, '')
    .replace(/\s+(software|problems|reddit|complaints|reviews|alternatives|pricing|competitors)\s+/g, ' ')
    .replace(/"([^"]+)"/g, '$1')
    .replace(/\s+or\s+/gi, ' ')
    .trim();
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
  // Require job similarity AND at least one other matching dimension
  if (match.jobSimilarity < 0.25) return false;

  let matchingDimensions = 0;
  if (match.jobSimilarity >= 0.25) matchingDimensions++;
  if (match.sameBuyer) matchingDimensions++;
  if (match.sameVertical) matchingDimensions++;
  if (match.sameTrigger) matchingDimensions++;

  return matchingDimensions >= 2;
}

function groupByMultiDimension(signals: RawSignal[]): SignalGroup[] {
  const groups: SignalGroup[] = [];

  for (const signal of signals) {
    const job = extractJobToBeDone(signal.query, signal.evidence);
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
