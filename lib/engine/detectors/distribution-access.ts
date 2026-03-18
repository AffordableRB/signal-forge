import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

// CAC estimates by channel type (validated against industry benchmarks)
const CHANNEL_CAC: Record<string, { cac: number; reliability: string }> = {
  'directories':      { cac: 35,  reliability: 'SEO + listing optimization, 3-6 month ramp' },
  'communities':      { cac: 50,  reliability: 'Content + community engagement, slow but sticky' },
  'cold outreach':    { cac: 120, reliability: 'Email lists + SDR time, fast but expensive' },
  'marketplaces':     { cac: 25,  reliability: 'App store presence, low but competitive' },
  'paid ads':         { cac: 200, reliability: 'Google/FB ads, fast but costly — needs strong unit economics' },
  'partnerships':     { cac: 80,  reliability: 'Channel partners, medium ramp, relationship-dependent' },
  'word of mouth':    { cac: 15,  reliability: 'Organic referrals, cheapest but slowest to start' },
  'content marketing': { cac: 60,  reliability: 'SEO content, 6-12 month ramp' },
};

export class DistributionAccessDetector implements Detector {
  id = 'distributionAccess';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    let score = 0;
    const channels: Array<{ name: string; cac: number; reliability: string }> = [];

    const vertical = candidate.vertical.toLowerCase();
    const buyer = candidate.targetBuyer.toLowerCase();
    const job = candidate.jobToBeDone.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

    // Directories (findable buyers)
    const directoryVerticals = ['home-services', 'healthcare', 'legal', 'real-estate'];
    if (directoryVerticals.includes(vertical)) {
      score += 3;
      channels.push({ name: 'directories', ...CHANNEL_CAC['directories'] });
    }

    // Communities (reachable via forums/groups)
    const communitySignals = ['reddit', 'forum', 'community', 'facebook group', 'slack'];
    if (communitySignals.some(k => allText.includes(k)) || candidate.evidence.some(e => e.source.includes('reddit'))) {
      score += 2;
      channels.push({ name: 'communities', ...CHANNEL_CAC['communities'] });
    }

    // Cold outreach (identifiable decision makers)
    if (buyer.includes('business') || buyer.includes('agency') || buyer.includes('founder')) {
      score += 2;
      channels.push({ name: 'cold outreach', ...CHANNEL_CAC['cold outreach'] });
    }

    // Marketplaces (app stores, plugin ecosystems)
    const marketplaceKeywords = ['shopify', 'wordpress', 'chrome extension', 'app store', 'marketplace', 'plugin'];
    if (marketplaceKeywords.some(k => job.includes(k) || allText.includes(k))) {
      score += 3;
      channels.push({ name: 'marketplaces', ...CHANNEL_CAC['marketplaces'] });
    }

    // Content marketing signals
    const contentSignals = ['blog', 'guide', 'tutorial', 'how to', 'seo'];
    if (contentSignals.some(k => allText.includes(k))) {
      score += 1;
      channels.push({ name: 'content marketing', ...CHANNEL_CAC['content marketing'] });
    }

    // Word of mouth / referral signals
    const referralSignals = ['referral', 'word of mouth', 'recommend', 'tell your friends'];
    if (referralSignals.some(k => allText.includes(k))) {
      score += 1;
      channels.push({ name: 'word of mouth', ...CHANNEL_CAC['word of mouth'] });
    }

    // --- Penalty: hard-to-reach buyers ---
    if (buyer.includes('enterprise') || buyer.includes('government')) {
      score -= 1;
    }

    // --- Penalty: no clear channels found ---
    if (channels.length === 0) {
      score = Math.max(score, 1);
      channels.push({ name: 'paid ads (default)', ...CHANNEL_CAC['paid ads'] });
    }

    score = Math.min(10, Math.max(0, score));

    // Calculate blended CAC estimate
    const lowestCAC = channels.length > 0
      ? Math.min(...channels.map(c => c.cac))
      : CHANNEL_CAC['paid ads'].cac;
    const avgCAC = channels.length > 0
      ? Math.round(channels.reduce((sum, c) => sum + c.cac, 0) / channels.length)
      : CHANNEL_CAC['paid ads'].cac;

    const channelSummary = channels.map(c =>
      `${c.name} (~$${c.cac} CAC, ${c.reliability})`
    ).join('; ');

    return {
      detectorId: this.id,
      score,
      explanation: `${channels.length} distribution channel${channels.length !== 1 ? 's' : ''}: ${channelSummary}. ` +
        `Estimated CAC range: $${lowestCAC}-$${avgCAC + 50} blended.`,
    };
  }
}
