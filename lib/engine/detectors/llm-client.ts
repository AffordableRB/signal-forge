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

// ─── Cost tracking ────────────────────────────────────────────────────
// Sonnet 4 pricing: $3/M input, $15/M output
const COST_PER_INPUT_TOKEN = 3 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000;

interface CostAccumulator {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

let scanCost: CostAccumulator = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

export function resetCostTracker(): void {
  scanCost = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

export function getCostTracker(): CostAccumulator {
  return { ...scanCost };
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

    // Track costs
    const inp = response.usage?.input_tokens ?? 0;
    const out = response.usage?.output_tokens ?? 0;
    scanCost.calls++;
    scanCost.inputTokens += inp;
    scanCost.outputTokens += out;
    scanCost.costUsd += inp * COST_PER_INPUT_TOKEN + out * COST_PER_OUTPUT_TOKEN;

    const block = response.content[0];
    if (block.type === 'text') return block.text;
    return null;
  } catch (err) {
    console.error('[LLM] Claude API error:', err instanceof Error ? err.message : err);
    return null;
  }
}
