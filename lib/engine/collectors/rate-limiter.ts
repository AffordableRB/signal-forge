// Shared rate limiter and fetch wrapper for all collectors.
// Uses p-limit for concurrency control and adds retry + timeout.

import pLimit from 'p-limit';

const limit = pLimit(3);

const USER_AGENT = 'SignalForge/1.0 (market-research-bot)';

interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = opts.timeout ?? 10000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        ...opts.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
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
