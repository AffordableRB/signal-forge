import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class EaseToBuildDetector implements Detector {
  id = 'easeToBuild';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const job = candidate.jobToBeDone.toLowerCase();
    let score = 5; // Default: moderate complexity
    const reasons: string[] = [];

    // Simple integrations
    const simplePatterns = ['notification', 'alert', 'reminder', 'form', 'scheduling', 'booking', 'tracking', 'dashboard'];
    if (simplePatterns.some(p => job.includes(p))) {
      score += 2;
      reasons.push('Standard integration pattern');
    }

    // Complex implementations
    const complexPatterns = ['ai model', 'machine learning', 'blockchain', 'real-time video', 'hardware', 'marketplace'];
    if (complexPatterns.some(p => job.includes(p))) {
      score -= 3;
      reasons.push('Complex implementation required');
    }

    // API-first approaches are easier
    const apiPatterns = ['automation', 'integration', 'sync', 'webhook', 'api'];
    if (apiPatterns.some(p => job.includes(p))) {
      score += 1;
      reasons.push('API-first approach viable');
    }

    // Regulated industries are harder
    const regulatedVerticals = ['healthcare', 'finance', 'legal'];
    if (regulatedVerticals.includes(candidate.vertical)) {
      score -= 1;
      reasons.push('Regulated industry adds complexity');
    }

    score = Math.max(1, Math.min(10, score));

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'Standard implementation complexity.',
    };
  }
}
