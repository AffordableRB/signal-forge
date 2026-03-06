import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchJson } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

const TARGET_SUBREDDITS = [
  'entrepreneur', 'startups', 'smallbusiness', 'SaaS',
  'realestateinvesting', 'landlord', 'propertymanagement',
  'contractors', 'plumbing', 'HVAC',
  'legaladvice', 'accounting',
];

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

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchRedditSignals(query);
      if (evidence.length > 0) {
        signals.push({
          collectorId: this.id,
          timestamp: new Date().toISOString(),
          query,
          evidence,
        });
      }
    }

    return signals;
  }

  private async fetchRedditSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Search across Reddit
    try {
      const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=25&sort=relevance&t=year`;
      const data = await throttledFetchJson<RedditListing>(searchUrl, {
        headers: { 'Accept': 'application/json' },
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
        const isTargetSub = TARGET_SUBREDDITS.some(s =>
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

    // Also search specific subreddits for higher relevance
    const topSubs = TARGET_SUBREDDITS.slice(0, 4);
    for (const sub of topSubs) {
      try {
        const subUrl = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=10&sort=relevance&t=year`;
        const data = await throttledFetchJson<RedditListing>(subUrl, {
          headers: { 'Accept': 'application/json' },
        });

        const subQueryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

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
    }

    return evidence;
  }
}
