import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET() {
  const provider = (process.env.PROXY_PROVIDER ?? 'scraperapi').toLowerCase();
  let apiKey: string | null = null;

  if (provider === 'scrapeops') apiKey = process.env.SCRAPEOPS_API_KEY ?? null;
  else if (provider === 'scrapingbee') apiKey = process.env.SCRAPINGBEE_API_KEY ?? null;
  else apiKey = process.env.SCRAPER_API_KEY ?? null;

  if (!apiKey) {
    return NextResponse.json({ error: 'No proxy API key found', provider });
  }

  // Test with a simple target URL
  const targetUrl = 'https://www.reddit.com/search.json?q=test&limit=1';
  let proxyUrl: string;

  if (provider === 'scrapeops') {
    proxyUrl = `https://proxy.scrapeops.io/v1/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
  } else if (provider === 'scrapingbee') {
    proxyUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
  } else {
    proxyUrl = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/json',
      },
    });
    clearTimeout(timer);

    const body = await res.text();

    return NextResponse.json({
      provider,
      status: res.status,
      statusText: res.statusText,
      bodyLength: body.length,
      bodyPreview: body.slice(0, 500),
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (err) {
    return NextResponse.json({
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
