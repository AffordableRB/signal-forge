import { NextResponse } from 'next/server';
import { isLLMAvailable } from '@/lib/engine/detectors/llm-client';
import { hasProxyKey } from '@/lib/engine/collectors/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const proxyProvider = (process.env.PROXY_PROVIDER ?? 'scraperapi').toLowerCase();
  return NextResponse.json({
    llmAvailable: isLLMAvailable(),
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 7) ?? 'not-set',
    proxy: {
      provider: proxyProvider,
      hasKey: hasProxyKey(),
      scraperApiKey: !!process.env.SCRAPER_API_KEY,
      scrapeOpsKey: !!process.env.SCRAPEOPS_API_KEY,
      scrapingBeeKey: !!process.env.SCRAPINGBEE_API_KEY,
    },
  });
}
