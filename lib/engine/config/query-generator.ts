// Topic-focused query generator.
// Uses Claude to generate targeted search queries from a user-provided topic/industry.
// Falls back to template-based generation when no API key is set.

import { callClaude, isLLMAvailable } from '../detectors/llm-client';

const QUERY_SYSTEM_PROMPT = `You generate search queries to discover business opportunities and pain points in a specific industry or topic.

RULES:
- Generate exactly the number of queries requested
- Each query should target a DIFFERENT angle: pain points, complaints, workflow problems, expensive manual processes, software gaps, hiring difficulties, regulatory burdens, pricing frustrations
- Queries should be what a real person would type into Google or Reddit search
- Mix formats: some should target Reddit/forums, some Google, some review sites
- Be SPECIFIC to the industry. "construction scheduling problems" is better than "business problems"
- Include queries that would find: existing competitors, pricing data, job postings (signals of manual work), complaints about current solutions
- Do NOT include generic business queries. Every query must relate to the specific topic.

OUTPUT FORMAT:
Return ONLY a JSON array of strings, no markdown fences, no explanation.
Example: ["query 1", "query 2", "query 3"]`;

function buildQueryPrompt(topic: string, count: number, existingFindings?: string[]): string {
  const parts = [`Generate ${count} search queries to discover business opportunities in: "${topic}"`];

  if (existingFindings && existingFindings.length > 0) {
    parts.push('');
    parts.push('We already found these opportunities in previous rounds:');
    for (const finding of existingFindings) {
      parts.push(`  - ${finding}`);
    }
    parts.push('');
    parts.push('Generate queries that explore DIFFERENT angles and dig DEEPER into the most promising areas.');
    parts.push('Avoid queries that would return the same results as before.');
  }

  return parts.join('\n');
}

function parseQueryResponse(raw: string): string[] {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === 'string' && q.length > 0);
  } catch {
    return [];
  }
}

// Template-based fallback when no LLM available
function generateTemplateQueries(topic: string, count: number): string[] {
  const templates = [
    `${topic} software problems reddit`,
    `${topic} workflow automation pain points`,
    `${topic} "too expensive" OR "waste of time" OR "manual process"`,
    `${topic} competitors alternatives pricing`,
    `${topic} complaints reviews`,
    `${topic} hiring difficulties OR "can't find" OR "looking for"`,
    `${topic} scheduling OR dispatch OR tracking software`,
    `${topic} small business challenges 2024 2025`,
    `${topic} "I wish there was" OR "someone should build"`,
    `${topic} industry trends market size`,
    `${topic} regulatory compliance software`,
    `${topic} invoicing billing payment problems`,
    `${topic} customer management CRM alternative`,
    `${topic} reporting analytics dashboard`,
    `${topic} communication coordination problems`,
    `${topic} training onboarding challenges`,
  ];
  return templates.slice(0, count);
}

export async function generateQueries(
  topic: string,
  count: number = 8,
  existingFindings?: string[],
): Promise<string[]> {
  if (!isLLMAvailable()) {
    console.log('[QueryGen] No API key — using template queries');
    return generateTemplateQueries(topic, count);
  }

  console.log(`[QueryGen] Generating ${count} queries for topic: "${topic}"`);
  const prompt = buildQueryPrompt(topic, count, existingFindings);
  const response = await callClaude(QUERY_SYSTEM_PROMPT, prompt, 1000);

  if (!response) {
    console.warn('[QueryGen] LLM failed — falling back to templates');
    return generateTemplateQueries(topic, count);
  }

  const queries = parseQueryResponse(response);
  if (queries.length === 0) {
    console.warn('[QueryGen] Failed to parse LLM response — falling back to templates');
    return generateTemplateQueries(topic, count);
  }

  console.log(`[QueryGen] Generated ${queries.length} queries`);
  return queries.slice(0, count);
}
