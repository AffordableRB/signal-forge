import { OpportunityCandidate, RiskFlag } from '../models/types';

interface KillRule {
  id: string;
  severity: 'low' | 'medium' | 'high';
  test: (c: OpportunityCandidate) => string | null;
}

const KILL_RULES: KillRule[] = [
  {
    id: 'massive-consumer-distribution',
    severity: 'high',
    test(c) {
      const consumerKeywords = ['consumer', 'b2c', 'social', 'viral', 'mass market', 'everyone'];
      const text = `${c.jobToBeDone} ${c.targetBuyer}`.toLowerCase();
      const distScore = c.detectorResults.find(r => r.detectorId === 'distributionAccess')?.score ?? 5;
      if (consumerKeywords.some(k => text.includes(k)) && distScore < 5) {
        return 'Requires massive consumer distribution without clear channel access';
      }
      return null;
    },
  },
  {
    id: 'fragile-data-dependency',
    severity: 'medium',
    test(c) {
      const fragileKeywords = ['scraping', 'scrape', 'crawl', 'screen capture'];
      const allText = c.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
      const job = c.jobToBeDone.toLowerCase();
      if (fragileKeywords.some(k => allText.includes(k) || job.includes(k))) {
        return 'Depends on scraping or fragile data sources that can break without notice';
      }
      return null;
    },
  },
  {
    id: 'regulatory-barriers',
    severity: 'high',
    test(c) {
      const regulatedVerticals = ['healthcare', 'finance', 'legal'];
      const regulatoryKeywords = ['hipaa', 'gdpr', 'pci', 'compliance', 'regulated', 'licensed'];
      const allText = c.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
      if (
        regulatedVerticals.includes(c.vertical) &&
        regulatoryKeywords.some(k => allText.includes(k) || c.jobToBeDone.toLowerCase().includes(k))
      ) {
        return `Regulatory barriers in ${c.vertical}: may require compliance certifications or legal review`;
      }
      return null;
    },
  },
  {
    id: 'weak-pain-signals',
    severity: 'medium',
    test(c) {
      const painScore = c.detectorResults.find(r => r.detectorId === 'painIntensity')?.score ?? 0;
      const painSignals = c.evidence.filter(e => e.signalType === 'pain');
      if (painScore <= 3 && painSignals.length < 2) {
        return 'Weak pain signals: problem may be a mild inconvenience rather than a must-fix';
      }
      return null;
    },
  },
  {
    id: 'hype-driven-ai',
    severity: 'high',
    test(c) {
      const job = c.jobToBeDone.toLowerCase();
      const hypePatterns = ['ai resume', 'ai chatbot', 'ai writing', 'ai art', 'ai image', 'ai content'];
      const allText = c.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
      const saturationKeywords = ['crowded', 'commoditized', 'hundreds of', 'red ocean', 'mature'];
      const hasSaturation = saturationKeywords.some(k => allText.includes(k));
      const compScore = c.detectorResults.find(r => r.detectorId === 'competitionWeakness')?.score ?? 5;

      if (hypePatterns.some(p => job.includes(p))) {
        if (compScore < 5 || hasSaturation) {
          return 'Hype-driven AI idea in a commoditized market with strong existing competition';
        }
        return 'Commoditized AI category: high competition likely, validate differentiation carefully';
      }
      const aiScore = c.detectorResults.find(r => r.detectorId === 'aiAdvantage')?.score ?? 0;
      if (job.startsWith('ai ') && aiScore <= 2 && compScore < 5) {
        return 'AI wrapper without meaningful technical differentiation';
      }
      return null;
    },
  },
  {
    id: 'no-clear-revenue-model',
    severity: 'medium',
    test(c) {
      const moneySignals = c.evidence.filter(e => e.signalType === 'money');
      const payScore = c.detectorResults.find(r => r.detectorId === 'abilityToPay')?.score ?? 0;
      if (moneySignals.length === 0 && payScore < 3) {
        return 'No money signals and low ability-to-pay: revenue model unclear';
      }
      return null;
    },
  },
  {
    id: 'crowded-market-no-wedge',
    severity: 'medium',
    test(c) {
      const compScore = c.detectorResults.find(r => r.detectorId === 'competitionWeakness')?.score ?? 5;
      const easeScore = c.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 5;
      const allText = c.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
      const crowdedKeywords = ['crowded', 'hundreds of', 'red ocean', 'commoditized', 'mature'];
      if (crowdedKeywords.some(k => allText.includes(k)) && compScore < 6 && easeScore < 6) {
        return 'Crowded market with no clear competitive wedge or technical moat';
      }
      return null;
    },
  },
  {
    id: 'single-source-signals',
    severity: 'low',
    test(c) {
      const sources = new Set(c.evidence.map(e => e.source.split(':')[0]));
      if (sources.size <= 1 && c.evidence.length > 0) {
        return 'All signals from a single source type: cross-validate with additional data';
      }
      return null;
    },
  },
];

export function applyKillSwitch(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return candidates.map(c => {
    const flags: RiskFlag[] = [];
    for (const rule of KILL_RULES) {
      const result = rule.test(c);
      if (result) {
        flags.push({ id: rule.id, severity: rule.severity, description: result });
      }
    }
    return { ...c, riskFlags: flags };
  });
}
