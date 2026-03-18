// Topic-focused query generator.
// Uses Claude to generate targeted search queries from a user-provided topic/industry.
// Falls back to template-based generation when no API key is set.

import { callClaude, isLLMAvailable } from '../detectors/llm-client';

const QUERY_SYSTEM_PROMPT = `You generate search queries to discover business opportunities and pain points in a specific industry or topic.

MANDATORY CATEGORIES — you MUST include at least one query from each category (in order of priority):
1. PAIN: Find complaints, frustrations, and problems people have ("X is broken", "hate using", "waste of time")
2. COMPETITION: Find existing tools, competitors, and alternatives ("best X software", "X alternatives", "compare X tools")
3. DEMAND: Find people actively looking for solutions ("looking for X", "need a tool for", "recommend X software")
4. MONEY: Find pricing, willingness to pay, job postings that signal manual work ("X pricing", "X cost", "hiring X coordinator")

If more queries are requested, add from these bonus categories:
5. GAPS: Find unmet needs ("I wish there was", "someone should build", "no good tool for")
6. TRENDS: Find market timing signals ("X industry 2025", "new regulations for X")

RULES:
- Queries should be what a real person would type into Google or Reddit search
- Be SPECIFIC to the industry. "construction scheduling problems" is better than "business problems"
- Do NOT include generic business queries. Every query must relate to the specific topic.
- Do NOT prefix queries with category labels. Just return the raw search query strings.

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
  // Ordered by mandatory category: PAIN, COMPETITION, DEMAND, MONEY, then bonus
  const templates = [
    `${topic} problems complaints "waste of time" reddit`,
    `${topic} software alternatives competitors pricing`,
    `${topic} "looking for" OR "need a tool" OR "recommend" software`,
    `${topic} pricing cost hiring coordinator OR specialist`,
    `${topic} "I wish there was" OR "someone should build"`,
    `${topic} industry trends 2025 challenges`,
    `${topic} workflow automation pain points`,
    `${topic} reviews "too expensive" OR frustrating`,
    `${topic} small business challenges manual process`,
    `${topic} scheduling OR dispatch OR tracking software`,
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
