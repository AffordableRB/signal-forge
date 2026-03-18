import { NextResponse } from 'next/server';
import { isLLMAvailable } from '@/lib/engine/detectors/llm-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    llmAvailable: isLLMAvailable(),
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasScraperKey: !!process.env.SCRAPER_API_KEY,
    keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 7) ?? 'not-set',
  });
}
