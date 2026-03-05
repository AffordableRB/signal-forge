import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class DistributionAccessDetector implements Detector {
  id = 'distributionAccess';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    let score = 0;
    const channels: string[] = [];

    const vertical = candidate.vertical.toLowerCase();
    const buyer = candidate.targetBuyer.toLowerCase();
    const job = candidate.jobToBeDone.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

    // Directories (findable buyers)
    const directoryVerticals = ['home-services', 'healthcare', 'legal', 'real-estate'];
    if (directoryVerticals.includes(vertical)) {
      score += 3;
      channels.push('directories');
    }

    // Communities (reachable via forums/groups)
    const communitySignals = ['reddit', 'forum', 'community', 'facebook group', 'slack'];
    if (communitySignals.some(k => allText.includes(k)) || candidate.evidence.some(e => e.source.includes('reddit'))) {
      score += 2;
      channels.push('communities');
    }

    // Cold outreach (identifiable decision makers)
    if (buyer.includes('business') || buyer.includes('agency') || buyer.includes('founder')) {
      score += 2;
      channels.push('cold outreach');
    }

    // Marketplaces (app stores, plugin ecosystems)
    const marketplaceKeywords = ['shopify', 'wordpress', 'chrome extension', 'app store', 'marketplace', 'plugin'];
    if (marketplaceKeywords.some(k => job.includes(k) || allText.includes(k))) {
      score += 3;
      channels.push('marketplaces');
    }

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: `Distribution channels: ${channels.join(', ') || 'unclear'}. ${channels.length} viable channels identified.`,
    };
  }
}
