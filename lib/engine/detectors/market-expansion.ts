import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class MarketExpansionDetector implements Detector {
  id = 'marketExpansion';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const job = candidate.jobToBeDone.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    // Cross-vertical applicability
    const genericJobs = ['scheduling', 'invoicing', 'booking', 'crm', 'tracking', 'reporting', 'notifications', 'communication', 'automation', 'follow-up', 'recovery'];
    const matchingJobs = genericJobs.filter(j => job.includes(j));
    if (matchingJobs.length >= 1) {
      score += 4;
      reasons.push(`Replicable pattern: ${matchingJobs.join(', ')}`);
    }

    // Vertical-specific but expandable
    if (candidate.vertical !== 'general') {
      score += 2;
      reasons.push(`Start in ${candidate.vertical}, expand to adjacent verticals`);
    }

    // Multi-market evidence
    const uniqueSources = new Set(candidate.evidence.map(e => e.source));
    if (uniqueSources.size >= 4) {
      score += 2;
      reasons.push('Signals from diverse sources');
    }

    // Template/playbook potential
    const templateKeywords = ['template', 'workflow', 'process', 'standard', 'best practice'];
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
    if (templateKeywords.some(k => allText.includes(k) || job.includes(k))) {
      score += 2;
      reasons.push('Templateable across verticals');
    }

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'Limited expansion potential.',
    };
  }
}
