import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class WorkflowAnchorDetector implements Detector {
  id = 'workflowAnchor';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const job = candidate.jobToBeDone.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
    let score = 0;
    const reasons: string[] = [];

    // Recurring workflow signals
    const recurringKeywords = ['daily', 'weekly', 'monthly', 'every', 'recurring', 'routine', 'regular', 'ongoing'];
    if (recurringKeywords.some(k => allText.includes(k) || job.includes(k))) {
      score += 3;
      reasons.push('Recurring usage pattern');
    }

    // Operational necessity signals
    const operationalKeywords = ['manage', 'track', 'monitor', 'schedule', 'automate', 'workflow', 'process'];
    const opCount = operationalKeywords.filter(k => job.includes(k) || allText.includes(k)).length;
    if (opCount >= 2) {
      score += 3;
      reasons.push('Core operational workflow');
    } else if (opCount >= 1) {
      score += 2;
      reasons.push('Operational workflow component');
    }

    // Habit formation signals
    const habitKeywords = ['every day', 'every week', 'first thing', 'always', 'constantly'];
    if (habitKeywords.some(k => allText.includes(k))) {
      score += 2;
      reasons.push('Habit-forming usage');
    }

    // One-time usage indicators (negative)
    const oneTimeKeywords = ['one-time', 'once', 'setup only', 'migration'];
    if (oneTimeKeywords.some(k => job.includes(k) || allText.includes(k))) {
      score -= 3;
      reasons.push('One-time usage pattern');
    }

    score = Math.max(1, Math.min(10, score));

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'No clear workflow anchor pattern.',
    };
  }
}
