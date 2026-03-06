// Shared rate limiter and fetch wrapper for all collectors.
// Uses p-limit for concurrency control and adds retry + timeout.
// Routes through ScraperAPI proxy when SCRAPER_API_KEY is set.

import pLimit from 'p-limit';

const limit = pLimit(3);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  // Set true to route through ScraperAPI proxy (for bot-protected sites)
  useProxy?: boolean;
}

function getProxyUrl(targetUrl: string): string | null {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) return null;
  return `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
}

async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const controller = new AbortController();
  // Proxy requests need more time (ScraperAPI can take 10-30s)
  const timeout = opts.timeout ?? (opts.useProxy ? 30000 : 10000);
  const timer = setTimeout(() => controller.abort(), timeout);

  let fetchUrl = url;
  if (opts.useProxy) {
    const proxied = getProxyUrl(url);
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

export function hasProxyKey(): boolean {
  return !!process.env.SCRAPER_API_KEY;
}

export async function throttledFetch(url: string, opts: FetchOptions = {}): Promise<Response> {
  return limit(() => fetchWithTimeout(url, opts));
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
