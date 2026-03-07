import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchJson } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// GitHub Search API — free, no auth required (10 requests/min unauthenticated).
// Repos = competition signals (what's being built).
// Issues = pain/demand signals (what problems people have).
// Stars/forks = market validation.

interface GHRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  topics: string[];
  language: string | null;
}

interface GHRepoResponse {
  total_count: number;
  items: GHRepo[];
}

interface GHIssue {
  title: string;
  html_url: string;
  body: string | null;
  state: string;
  comments: number;
  created_at: string;
  reactions?: { total_count: number };
  labels: Array<{ name: string }>;
}

interface GHIssueResponse {
  total_count: number;
  items: GHIssue[];
}

export class GitHubCollector implements Collector {
  id = 'github';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const seen = new Set<string>();
    const maxQueries = Math.min(queries.length, 3);

    for (const query of queries.slice(0, maxQueries)) {
      const evidence = await this.fetchGitHubSignals(query, seen);
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

  private async fetchGitHubSignals(query: string, seen: Set<string>): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Simplify query for GitHub search (strip forum-targeting words)
    const simplified = this.simplifyQuery(query);

    await Promise.allSettled([
      this.searchRepos(simplified, seen, evidence),
      this.searchIssues(simplified, seen, evidence),
    ]);

    return evidence;
  }

  private simplifyQuery(query: string): string {
    const noise = new Set([
      'reddit', 'complaints', 'reviews', 'alternatives', 'problems',
      'challenges', 'difficulties', 'expensive', 'struggling', 'complaining',
    ]);
    return query.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2 && !noise.has(w))
      .slice(0, 5)
      .join(' ');
  }

  private async searchRepos(query: string, seen: Set<string>, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`;
      const data = await throttledFetchJson<GHRepoResponse>(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
      });

      for (const repo of data.items) {
        if (seen.has(repo.html_url)) continue;
        seen.add(repo.html_url);

        const desc = repo.description ?? '';
        if (desc.length < 10) continue;

        // Stars indicate market validation
        let confMin = 0.5;
        let confMax = 0.7;
        if (repo.stargazers_count > 100) { confMin = 0.6; confMax = 0.8; }
        if (repo.stargazers_count > 1000) { confMin = 0.7; confMax = 0.85; }

        const text = `${repo.full_name}: ${desc}`;
        const stars = repo.stargazers_count;
        const forks = repo.forks_count;

        evidence.push({
          source: 'github:repo',
          url: repo.html_url,
          excerpt: `${desc.slice(0, 200)} (${stars} stars, ${forks} forks, ${repo.open_issues_count} issues)`,
          signalType: 'competition',
          sourceTier: 2,
          confidence: computeConfidence(text, confMin, confMax),
          timestamp: new Date(repo.updated_at).getTime(),
        });
      }

      // Meta-signal: total repo count indicates market activity
      if (data.total_count > 0) {
        evidence.push({
          source: 'github:analysis',
          url: `https://github.com/search?q=${encodeURIComponent(query)}`,
          excerpt: `${data.total_count} repositories found for "${query}" — indicates active development in this space.`,
          signalType: data.total_count > 50 ? 'competition' : 'demand',
          sourceTier: 2,
          confidence: 0.65,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn(`[GitHub] Repo search failed for "${query}":`, (err as Error).message);
    }
  }

  private async searchIssues(query: string, seen: Set<string>, evidence: Evidence[]): Promise<void> {
    try {
      // Search for issues that contain the query terms — add label qualifiers
      // to find feature requests and bug reports specifically
      const issueQuery = `${query} is:issue label:bug,feature,enhancement,"feature request"`;
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(issueQuery)}&sort=reactions&order=desc&per_page=10`;
      const data = await throttledFetchJson<GHIssueResponse>(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
      });

      // Extract domain keywords to filter relevant issues
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

      for (const issue of data.items) {
        if (seen.has(issue.html_url)) continue;

        const titleLower = issue.title.toLowerCase();
        // Issue title must contain at least one query keyword
        const isRelevant = queryWords.some(kw => titleLower.includes(kw));
        if (!isRelevant) continue;

        seen.add(issue.html_url);

        const body = (issue.body ?? '').slice(0, 300);
        const text = `${issue.title} ${body}`;
        if (text.trim().length < 20) continue;

        const labels = issue.labels.map(l => l.name.toLowerCase());
        const isFeatureRequest = labels.some(l =>
          l.includes('feature') || l.includes('enhancement') || l.includes('request')
        );
        const isBug = labels.some(l => l.includes('bug'));

        let signalType = classifySignal(text);
        if (isFeatureRequest) signalType = 'demand';
        if (isBug) signalType = 'pain';

        const reactions = issue.reactions?.total_count ?? 0;
        let confMin = 0.5;
        let confMax = 0.7;
        if (reactions > 5) { confMin = 0.6; confMax = 0.8; }
        if (issue.comments > 10) { confMin += 0.05; confMax = Math.min(0.85, confMax + 0.05); }

        evidence.push({
          source: 'github:issue',
          url: issue.html_url,
          excerpt: `${issue.title} (${issue.comments} comments, ${reactions} reactions)`,
          signalType,
          sourceTier: 2,
          confidence: computeConfidence(text, confMin, confMax),
          timestamp: new Date(issue.created_at).getTime(),
        });
      }
    } catch (err) {
      console.warn(`[GitHub] Issue search failed for "${query}":`, (err as Error).message);
    }
  }
}
