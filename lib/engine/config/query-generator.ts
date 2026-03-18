// Discovery-first query generator.
// Generates exploration queries to FIND niche business opportunities within a broad space.
// The goal is NOT to evaluate the topic itself, but to discover specific underserved
// niches, pain points, and gaps that could become businesses.
//
// Flow: broad space → discover specific niches → evaluate those niches

import { callClaude, isLLMAvailable } from '../detectors/llm-client';

const DISCOVERY_SYSTEM_PROMPT = `You are a niche business opportunity scout. Given a broad industry or space, you generate search queries to DISCOVER specific underserved niches and business opportunities within it.

CRITICAL: You are NOT evaluating the topic itself. You are exploring the SPACE to find specific problems that could become SaaS businesses.

Example: If the topic is "beauty", you should NOT generate "beauty software problems". Instead, generate queries like:
- "salon owners struggling with booking no-shows"
- "estheticians need help managing client photos before after"
- "beauty supply store inventory management frustrating"
- "freelance makeup artist invoicing clients reddit"
- "nail salon scheduling software too expensive"

Each query should target a SPECIFIC sub-niche, buyer persona, or workflow within the broad space.

MANDATORY CATEGORIES — at least 2 queries each:
1. SUB-NICHE PAIN: Find specific roles/businesses within the space complaining about specific workflows
   ("X role struggling with Y task", "X type of business wasting time on Y")
2. UNDERSERVED SEGMENTS: Find small/overlooked segments the big players ignore
   ("solo X looking for", "small X can't afford", "independent X need")
3. WORKFLOW GAPS: Find manual processes that could be automated
   ("X still using spreadsheets for", "X doing Y manually", "no good tool for X workflow")
4. SPENDING SIGNALS: Find where money is being wasted or people are hiring for tasks software could replace
   ("hiring X coordinator", "paying too much for Y", "X freelancer rates")

If more queries are requested, add from:
5. EMERGING NICHES: New regulations, trends creating new needs ("new X regulation", "X industry changing")
6. CROSS-INDUSTRY: Adjacent spaces with similar problems ("X for Y industry" where Y is underserved)

RULES:
- Every query must target a SPECIFIC sub-niche, not the broad topic
- Queries should surface DIFFERENT opportunities (don't cluster around one niche)
- Think about the SPECIFIC PEOPLE who have problems: salon owners, freelance stylists, supply distributors, etc.
- Include Reddit/forum-style queries where real people complain
- Cast a WIDE net across the space — the more diverse the niches, the better
- Do NOT generate queries about the broad topic itself

OUTPUT FORMAT:
Return ONLY a JSON array of strings, no markdown fences, no explanation.
Example: ["query 1", "query 2", "query 3"]`;

function buildDiscoveryPrompt(topic: string, count: number, existingFindings?: string[]): string {
  const parts = [`Explore the "${topic}" space and generate ${count} search queries to discover SPECIFIC niche business opportunities within it.`];
  parts.push('');
  parts.push(`Remember: "${topic}" is the SPACE to explore, not a business idea to evaluate.`);
  parts.push('Find specific sub-niches, underserved buyer personas, and painful workflows.');

  if (existingFindings && existingFindings.length > 0) {
    parts.push('');
    parts.push('We already discovered these niches in previous rounds:');
    for (const finding of existingFindings) {
      parts.push(`  - ${finding}`);
    }
    parts.push('');
    parts.push('Generate queries that explore DIFFERENT sub-niches we haven\'t covered yet.');
    parts.push('Go deeper into adjacent segments and overlooked buyer personas.');
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

// Template-based fallback when no LLM available.
// Generates EXPLORATION queries that discover niches within the space.
function generateTemplateQueries(topic: string, count: number): string[] {
  const templates = [
    // Sub-niche pain
    `"${topic}" small business owner struggling with reddit`,
    `"${topic}" freelancer "waste of time" OR "so frustrating" manual process`,
    // Underserved segments
    `solo "${topic}" professional "can't find" OR "no good" software tool`,
    `small "${topic}" business "too expensive" OR "can't afford" existing solutions`,
    // Workflow gaps
    `"${topic}" "still using spreadsheets" OR "doing it manually" OR "pen and paper"`,
    `"${topic}" scheduling OR booking OR invoicing OR tracking problems`,
    // Spending signals
    `"${topic}" hiring coordinator OR assistant OR manager "could automate"`,
    `"${topic}" "paying too much" OR "wasting money" on software OR tools`,
    // Emerging niches
    `"${topic}" new regulations OR compliance 2025 2026 challenges`,
    `"${topic}" industry trends underserved niche opportunity`,
    // Cross-industry
    `"${topic}" independent OR boutique OR local business needs better tools`,
    `"${topic}" workflow automation "someone should build" OR "wish there was"`,
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

  console.log(`[QueryGen] Exploring space: "${topic}" — generating ${count} discovery queries`);
  const prompt = buildDiscoveryPrompt(topic, count, existingFindings);
  const response = await callClaude(DISCOVERY_SYSTEM_PROMPT, prompt, 1500);

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
