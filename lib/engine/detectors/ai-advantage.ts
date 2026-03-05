import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class AIAdvantageDetector implements Detector {
  id = 'aiAdvantage';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const job = candidate.jobToBeDone.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
    let score = 0;
    const reasons: string[] = [];

    // Tasks that AI significantly improves
    const aiBoostPatterns = [
      { pattern: ['classify', 'categoriz', 'sort', 'triage'], label: 'Classification task' },
      { pattern: ['extract', 'parse', 'read', 'interpret'], label: 'Data extraction' },
      { pattern: ['generate', 'write', 'draft', 'compose'], label: 'Content generation' },
      { pattern: ['predict', 'forecast', 'estimate'], label: 'Prediction task' },
      { pattern: ['recommend', 'suggest', 'match'], label: 'Recommendation system' },
      { pattern: ['summariz', 'digest', 'overview'], label: 'Summarization' },
      { pattern: ['automat', 'auto-', 'hands-free'], label: 'Automation' },
      { pattern: ['respond', 'reply', 'follow-up', 'recovery'], label: 'Automated response' },
    ];

    for (const { pattern, label } of aiBoostPatterns) {
      if (pattern.some(p => job.includes(p) || allText.includes(p))) {
        score += 2;
        reasons.push(label);
      }
    }

    // Explicit AI mentions
    if (allText.includes('ai') || allText.includes('machine learning') || allText.includes('nlp')) {
      score += 1;
      reasons.push('AI explicitly mentioned in signals');
    }

    // Tasks where AI is table stakes (lower advantage)
    const commoditizedAI = ['chatbot', 'ai writing', 'ai art', 'ai image'];
    if (commoditizedAI.some(k => job.includes(k))) {
      score = Math.max(score - 3, 0);
      reasons.push('Commoditized AI application');
    }

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'No significant AI advantage identified.',
    };
  }
}
