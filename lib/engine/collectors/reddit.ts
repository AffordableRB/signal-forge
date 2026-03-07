import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchJson, hasProxyKey } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// Default business subreddits — used when no topic-specific subs are found
const DEFAULT_SUBREDDITS = [
  'entrepreneur', 'startups', 'smallbusiness', 'SaaS',
  'realestateinvesting', 'landlord', 'propertymanagement',
  'contractors', 'plumbing', 'HVAC',
  'legaladvice', 'accounting',
];

// Topic-to-subreddit mapping for common verticals
const TOPIC_SUBREDDITS: Record<string, string[]> = {
  fitness: ['fitness', 'gym', 'personaltraining', 'crossfit', 'bodybuilding', 'homegym', 'running', 'yogateachers', 'fitnessindustry'],
  health: ['healthcare', 'healthIT', 'medicine', 'nursing', 'physicaltherapy', 'mentalhealth', 'dietetics'],
  restaurant: ['restaurateur', 'KitchenConfidential', 'foodservice', 'restaurant', 'barowners'],
  food: ['restaurateur', 'KitchenConfidential', 'foodservice', 'foodindustry', 'foodtrucks'],
  construction: ['construction', 'contractors', 'electricians', 'plumbing', 'HVAC', 'HomeImprovement'],
  dental: ['dentistry', 'dental', 'DentalProfessionals', 'orthodontics'],
  legal: ['legaladvice', 'lawyers', 'LawFirm', 'paralegal'],
  education: ['teachers', 'education', 'edtech', 'tutoring', 'onlinelearning', 'professors'],
  ecommerce: ['ecommerce', 'shopify', 'FulfillmentByAmazon', 'dropship', 'Etsy'],
  realestate: ['realestateinvesting', 'landlord', 'propertymanagement', 'RealEstate', 'realtors'],
  cleaning: ['CleaningTips', 'CleaningService', 'smallbusiness', 'sweatystartup'],
  beauty: ['beauty', 'HairStylist', 'Esthetics', 'NailTechnicians', 'smallbusiness'],
  automotive: ['AutoDetailing', 'MechanicAdvice', 'AutoBody', 'mechanics', 'smallbusiness'],
  photography: ['photography', 'WeddingPhotography', 'videography', 'smallbusiness'],
  accounting: ['accounting', 'Bookkeeping', 'tax', 'CPA', 'smallbusiness'],
  marketing: ['marketing', 'digitalmarketing', 'SEO', 'PPC', 'socialmedia', 'agency'],
  pet: ['grooming', 'dogtraining', 'petcare', 'VetTech', 'smallbusiness'],
};

function getSubredditsForQueries(queries: string[]): string[] {
  const combined = queries.join(' ').toLowerCase();
  const matched: string[] = [];

  for (const [topic, subs] of Object.entries(TOPIC_SUBREDDITS)) {
    if (combined.includes(topic)) {
      matched.push(...subs);
    }
  }

  if (matched.length > 0) {
    // Also include some general business subs for broader context
    const generalSubs = ['entrepreneur', 'startups', 'smallbusiness'];
    const unique = Array.from(new Set([...matched, ...generalSubs]));
    return unique;
  }

  return DEFAULT_SUBREDDITS;
}

interface RedditPost {
  data: {
    title: string;
    selftext: string;
    subreddit: string;
    permalink: string;
    created_utc: number;
    score: number;
    num_comments: number;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

export class RedditCollector implements Collector {
  id = 'reddit';
  private resultLimit: number;
  private subDepth: number;
  private activeSubs: string[] = DEFAULT_SUBREDDITS;

  constructor(resultLimit?: number, subDepth?: number) {
    this.resultLimit = resultLimit ?? 25;
    this.subDepth = subDepth ?? 4;
  }

  async collect(queries: string[]): Promise<RawSignal[]> {
    // Resolve subreddits dynamically based on query content
    this.activeSubs = getSubredditsForQueries(queries);

    // Limit queries to avoid timeout — each query = 1 global + N sub searches via proxy
    const maxQueries = Math.min(queries.length, 2);
    const results = await Promise.allSettled(
      queries.slice(0, maxQueries).map(q => this.fetchRedditSignals(q))
    );

    const signals: RawSignal[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        signals.push({
          collectorId: this.id,
          timestamp: new Date().toISOString(),
          query: queries[i],
          evidence: result.value,
        });
      }
    }

    return signals;
  }

  private async fetchRedditSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Search across Reddit — route through proxy if available (Reddit blocks cloud IPs)
    try {
      const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${this.resultLimit}&sort=relevance&t=year`;
      const useProxy = hasProxyKey();
      const data = await throttledFetchJson<RedditListing>(searchUrl, {
        headers: { 'Accept': 'application/json' },
        useProxy,
      });

      const queryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

      for (const post of data.data.children) {
        const p = post.data;
        const text = `${p.title} ${p.selftext}`.slice(0, 500);
        if (text.trim().length < 20) continue;

        // Relevance check: post must contain at least 2 query keywords
        const textLower = text.toLowerCase();
        const keywordHits = queryKeywords.filter(kw => textLower.includes(kw)).length;
        if (keywordHits < Math.min(2, queryKeywords.length)) continue;

        const signalType = classifySignal(text);
        const isTargetSub = this.activeSubs.some(s =>
          p.subreddit.toLowerCase() === s.toLowerCase()
        );

        // Boost confidence for target subreddits and high-engagement posts
        let confMin = 0.6;
        let confMax = 0.8;
        if (isTargetSub) { confMin = 0.65; confMax = 0.85; }
        if (p.num_comments > 20) { confMin += 0.05; confMax = Math.min(0.9, confMax + 0.05); }

        evidence.push({
          source: `reddit:r/${p.subreddit}`,
          url: `https://reddit.com${p.permalink}`,
          excerpt: text.slice(0, 300),
          signalType,
          sourceTier: 2,
          confidence: computeConfidence(text, confMin, confMax),
          timestamp: p.created_utc * 1000,
        });
      }
    } catch (err) {
      console.warn(`[RedditCollector] Search failed for "${query}":`, (err as Error).message);
    }

    // Also search specific subreddits in parallel for higher relevance
    const topSubs = this.activeSubs.slice(0, this.subDepth);
    const subQueryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    await Promise.allSettled(topSubs.map(async (sub) => {
      try {
        const subUrl = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=10&sort=relevance&t=year`;
        const data = await throttledFetchJson<RedditListing>(subUrl, {
          headers: { 'Accept': 'application/json' },
          useProxy: hasProxyKey(),
        });

        for (const post of data.data.children) {
          const p = post.data;
          const text = `${p.title} ${p.selftext}`.slice(0, 500);
          if (text.trim().length < 20) continue;

          const textLower = text.toLowerCase();
          const hits = subQueryKeywords.filter(kw => textLower.includes(kw)).length;
          if (hits < Math.min(2, subQueryKeywords.length)) continue;

          evidence.push({
            source: `reddit:r/${p.subreddit}`,
            url: `https://reddit.com${p.permalink}`,
            excerpt: text.slice(0, 300),
            signalType: classifySignal(text),
            sourceTier: 2,
            confidence: computeConfidence(text, 0.65, 0.85),
            timestamp: p.created_utc * 1000,
          });
        }
      } catch {
        // Subreddit search failures are non-fatal
      }
    }));

    return evidence;
  }
}
