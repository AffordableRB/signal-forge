// Shared rate limiter and fetch wrapper for all collectors.
// Separate concurrency pools for direct and proxy requests
// so slow proxy calls don't block fast direct API calls.

import pLimit from 'p-limit';

// Direct requests (Reddit JSON, HN Algolia, Google autocomplete) — fast
const directLimit = pLimit(5);

// Proxy requests (ScraperAPI) — slower, fewer concurrent
const proxyLimit = pLimit(3);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  // Set true to route through ScraperAPI proxy (for bot-protected sites)
  useProxy?: boolean;
  // Set true for JS-rendered pages (costs 5 credits instead of 1 on ScraperAPI)
  render?: boolean;
}

function getProxyUrl(targetUrl: string, render?: boolean): string | null {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) return null;
  let proxyUrl = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
  if (render) proxyUrl += '&render=true';
  return proxyUrl;
}

async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = opts.timeout ?? (opts.useProxy ? 25000 : 8000);
  const timer = setTimeout(() => controller.abort(), timeout);

  let fetchUrl = url;
  if (opts.useProxy) {
    const proxied = getProxyUrl(url, opts.render);
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
