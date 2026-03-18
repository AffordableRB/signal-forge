// Shared rate limiter and fetch wrapper for all collectors.
// Separate concurrency pools for direct and proxy requests
// so slow proxy calls don't block fast direct API calls.
//
// Supports multiple proxy providers via PROXY_PROVIDER env var:
//   - scraperapi (default): api.scraperapi.com — SCRAPER_API_KEY
//   - scrapeops: proxy.scrapeops.io — SCRAPEOPS_API_KEY ($9.90/mo for 15K reqs)
//   - scrapingbee: app.scrapingbee.com — SCRAPINGBEE_API_KEY
//
// Falls back to ScraperAPI if PROXY_PROVIDER is not set.

import pLimit from 'p-limit';

// Direct requests (Reddit JSON, HN Algolia, Google autocomplete) — fast
const directLimit = pLimit(5);

// Proxy requests — slower, fewer concurrent
const proxyLimit = pLimit(3);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  // Set true to route through proxy (for bot-protected sites)
  useProxy?: boolean;
  // Set true for JS-rendered pages (costs more credits on most providers)
  render?: boolean;
}

// ─── Proxy provider abstraction ───────────────────────────────────────

type ProxyProvider = 'scraperapi' | 'scrapeops' | 'scrapingbee';

function getProxyProvider(): ProxyProvider {
  const provider = (process.env.PROXY_PROVIDER ?? '').toLowerCase();
  if (provider === 'scrapeops') return 'scrapeops';
  if (provider === 'scrapingbee') return 'scrapingbee';
  return 'scraperapi';
}

function getProxyApiKey(): string | null {
  const provider = getProxyProvider();
  switch (provider) {
    case 'scrapeops':
      return process.env.SCRAPEOPS_API_KEY ?? null;
    case 'scrapingbee':
      return process.env.SCRAPINGBEE_API_KEY ?? null;
    case 'scraperapi':
    default:
      return process.env.SCRAPER_API_KEY ?? null;
  }
}

function buildProxyUrl(targetUrl: string, render?: boolean): string | null {
  const apiKey = getProxyApiKey();
  if (!apiKey) return null;

  const encoded = encodeURIComponent(targetUrl);
  const provider = getProxyProvider();

  switch (provider) {
    case 'scrapeops': {
      // ScrapeOps Proxy API: https://proxy.scrapeops.io/v1/
      // $9.90/mo for 15K reqs, $29.90/mo for 50K
      let url = `https://proxy.scrapeops.io/v1/?api_key=${apiKey}&url=${encoded}`;
      if (render) url += '&render_js=true';
      return url;
    }
    case 'scrapingbee': {
      // ScrapingBee: https://app.scrapingbee.com/api/v1/
      // Pay-as-you-go available, ~$0.001/credit
      let url = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encoded}`;
      if (render) url += '&render_js=true';
      return url;
    }
    case 'scraperapi':
    default: {
      // ScraperAPI: https://api.scraperapi.com/
      // Free 1K credits, $49/mo for 100K
      let url = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encoded}`;
      if (render) url += '&render=true';
      return url;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export function hasProxyKey(): boolean {
  return !!getProxyApiKey();
}

async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = opts.timeout ?? (opts.useProxy ? 25000 : 8000);
  const timer = setTimeout(() => controller.abort(), timeout);

  let fetchUrl = url;
  if (opts.useProxy) {
    const proxied = buildProxyUrl(url, opts.render);
    if (proxied) {
      fetchUrl = proxied;
    }
  }

  try {
    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/json',
        ...opts.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function throttledFetch(url: string, opts: FetchOptions = {}): Promise<Response> {
  const limiter = opts.useProxy ? proxyLimit : directLimit;
  return limiter(() => fetchWithTimeout(url, opts));
}

export async function throttledFetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await throttledFetch(url, opts);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function throttledFetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await throttledFetch(url, opts);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}
