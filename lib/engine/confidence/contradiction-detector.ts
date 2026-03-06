import { OpportunityCandidate } from '../models/types';

export interface Contradiction {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  fields: [string, string]; // the two contradicting dimensions
}

export interface ContradictionResult {
  contradictions: Contradiction[];
  contradictionScore: number; // 0-100, higher = more contradictions = worse
}

export function detectContradictions(candidate: OpportunityCandidate): ContradictionResult {
  const contradictions: Contradiction[] = [];
  const dr = (id: string) => candidate.detectorResults.find(r => r.detectorId === id)?.score ?? 5;

  const painScore = dr('painIntensity');
  const demandScore = dr('demand');
  const compScore = dr('competitionWeakness');
  const easeScore = dr('easeToBuild');
  const workflowScore = dr('workflowAnchor');
  const distScore = dr('distributionAccess');
  const aiScore = dr('aiAdvantage');
  const timingScore = dr('marketTiming');
  const payScore = dr('abilityToPay');

  const ms = candidate.marketStructure;
  const eco = candidate.economicImpact;

  // 1. Low pain + high revenue loss
  if (eco && painScore <= 3 && eco.revenueLossPerMonth[1] > 5000) {
    contradictions.push({
      id: 'low-pain-high-revenue-loss',
      description: `Pain score is low (${painScore}/10) but estimated revenue loss is high ($${eco.revenueLossPerMonth[1]}/mo). Either pain is underdetected or revenue loss is overestimated.`,
      severity: 'high',
      fields: ['painIntensity', 'economicImpact.revenueLoss'],
    });
  }

  // 2. Blue ocean + many competitors
  if (ms && ms.type === 'blue' && ms.competitorCount > 5) {
    contradictions.push({
      id: 'blue-ocean-many-competitors',
      description: `Classified as Blue Ocean but ${ms.competitorCount} competitors detected. Blue ocean should have very few competitors.`,
      severity: 'high',
      fields: ['marketStructure.type', 'marketStructure.competitorCount'],
    });
  }

  // 3. Strong demand + weak buyer specificity
  if (demandScore >= 7 && candidate.targetBuyer.toLowerCase().includes('general')) {
    contradictions.push({
      id: 'strong-demand-weak-buyer',
      description: `High demand score (${demandScore}/10) but target buyer is vague ("${candidate.targetBuyer}"). Strong demand usually comes from a specific buyer segment.`,
      severity: 'medium',
      fields: ['demand', 'targetBuyer'],
    });
  }

  // 4. High urgency + low workflow anchor
  if (timingScore >= 7 && workflowScore <= 3) {
    contradictions.push({
      id: 'high-urgency-low-anchor',
      description: `High market timing (${timingScore}/10) but low workflow anchor (${workflowScore}/10). Urgent market but product may not stick in daily workflow.`,
      severity: 'medium',
      fields: ['marketTiming', 'workflowAnchor'],
    });
  }

  // 5. High competition weakness + high ease to build
  if (compScore >= 7 && easeScore >= 7 && (ms?.competitorCount ?? 0) > 10) {
    contradictions.push({
      id: 'weak-competition-easy-crowded',
      description: `Competitors scored as weak (${compScore}/10) and product is easy to build (${easeScore}/10), yet market has ${ms?.competitorCount} competitors. If it's easy and competitors are weak, why so many?`,
      severity: 'medium',
      fields: ['competitionWeakness', 'easeToBuild'],
    });
  }

  // 6. High demand + no money signals
  if (demandScore >= 7 && payScore <= 3) {
    contradictions.push({
      id: 'high-demand-no-money',
      description: `Strong demand signals (${demandScore}/10) but low ability to pay (${payScore}/10). Users want it but may not pay for it.`,
      severity: 'high',
      fields: ['demand', 'abilityToPay'],
    });
  }

  // 7. Easy to build + high AI advantage
  if (easeScore >= 8 && aiScore >= 7) {
    contradictions.push({
      id: 'easy-build-high-ai',
      description: `Product scored as very easy to build (${easeScore}/10) yet has high AI advantage (${aiScore}/10). Genuine AI advantages usually add complexity.`,
      severity: 'low',
      fields: ['easeToBuild', 'aiAdvantage'],
    });
  }

  // 8. Strong distribution + no clear buyer
  if (distScore >= 7 && (!candidate.targetBuyer || candidate.targetBuyer === 'Unknown')) {
    contradictions.push({
      id: 'strong-dist-no-buyer',
      description: `Good distribution access (${distScore}/10) but buyer is unclear. Distribution channels only work when you know who to target.`,
      severity: 'medium',
      fields: ['distributionAccess', 'targetBuyer'],
    });
  }

  // 9. Red ocean + high innovation gap
  if (ms && ms.type === 'red' && ms.innovationGap >= 7) {
    contradictions.push({
      id: 'red-ocean-high-innovation',
      description: `Classified as Red Ocean but innovation gap is ${ms.innovationGap}/10. High innovation gap usually means purple or blue ocean.`,
      severity: 'medium',
      fields: ['marketStructure.type', 'marketStructure.innovationGap'],
    });
  }

  // Calculate contradiction score (0-100)
  let rawScore = 0;
  for (const c of contradictions) {
    if (c.severity === 'high') rawScore += 25;
    else if (c.severity === 'medium') rawScore += 15;
    else rawScore += 8;
  }
  const contradictionScore = Math.min(100, rawScore);

  return { contradictions, contradictionScore };
}
