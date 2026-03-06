// Thin wrapper around Claude API for detector analysis.
// Falls back gracefully if ANTHROPIC_API_KEY is not set.

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

export function isLLMAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2000,
): Promise<string | null> {
  const c = getClient();
  if (!c) return null;

  try {
    const response = await c.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    if (block.type === 'text') return block.text;
    return null;
  } catch (err) {
    console.error('[LLM] Claude API error:', err instanceof Error ? err.message : err);
    return null;
  }
}
