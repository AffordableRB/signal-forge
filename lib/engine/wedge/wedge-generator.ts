import { OpportunityCandidate, PurpleOpportunity } from '../models/types';

interface WedgeTemplate {
  wedgeType: string;
  test: (c: OpportunityCandidate, text: string) => boolean;
  generate: (c: OpportunityCandidate) => { title: string; explanation: string; feasibility: number; impact: number };
}

const WEDGE_TEMPLATES: WedgeTemplate[] = [
  {
    wedgeType: 'ai-disruption',
    test: (c) => {
      const aiScore = c.detectorResults.find(r => r.detectorId === 'aiAdvantage')?.score ?? 0;
      return aiScore >= 4;
    },
    generate: (c) => ({
      title: `AI-powered ${c.jobToBeDone}`,
      explanation: `Use AI to automate the core workflow of ${c.jobToBeDone}. Current solutions require manual effort — AI can reduce time by 80%+ and eliminate human error.`,
      feasibility: 7,
      impact: 8,
    }),
  },
  {
    wedgeType: 'automation',
    test: (_c, text) => /manual|spreadsheet|paper|copy.paste|data\s+entry/i.test(text),
    generate: (c) => ({
      title: `End-to-end automation for ${c.jobToBeDone}`,
      explanation: `${c.targetBuyer}s still rely on manual processes. Build a workflow automation that connects existing tools and eliminates repetitive steps.`,
      feasibility: 8,
      impact: 7,
    }),
  },
  {
    wedgeType: 'segment-focus',
    test: (c) => c.vertical !== 'general',
    generate: (c) => ({
      title: `${c.jobToBeDone} built specifically for ${c.vertical}`,
      explanation: `Generic tools serve ${c.vertical} poorly. Build a vertical-specific solution with pre-built templates, integrations, and workflows tailored to ${c.targetBuyer}s.`,
      feasibility: 8,
      impact: 7,
    }),
  },
  {
    wedgeType: 'workflow-redesign',
    test: (_c, text) => /clunky|outdated|complicated|complex|confusing|steep\s+learning/i.test(text),
    generate: (c) => ({
      title: `Simplified ${c.jobToBeDone} — 10x easier UX`,
      explanation: `Incumbents have bloated, complex UIs. Redesign the workflow from scratch with a simple, opinionated interface that gets ${c.targetBuyer}s to value in minutes, not days.`,
      feasibility: 7,
      impact: 8,
    }),
  },
  {
    wedgeType: 'integration-bridge',
    test: (_c, text) => /integrat|connect|sync|api|zapier|webhook/i.test(text),
    generate: (c) => ({
      title: `Integration-first ${c.jobToBeDone}`,
      explanation: `Build as a bridge between existing tools rather than a replacement. Deep integrations with the tools ${c.targetBuyer}s already use, making adoption frictionless.`,
      feasibility: 7,
      impact: 6,
    }),
  },
  {
    wedgeType: 'pricing-disruption',
    test: (_c, text) => /expensive|overpriced|price\s*(hike|increase)|too\s+much|costly/i.test(text),
    generate: (c) => ({
      title: `Affordable ${c.jobToBeDone} — 70% less than incumbents`,
      explanation: `Incumbents have raised prices aggressively. Offer the core functionality at a fraction of the cost with transparent, usage-based pricing. Target price-sensitive ${c.targetBuyer}s.`,
      feasibility: 6,
      impact: 7,
    }),
  },
  {
    wedgeType: 'voice-mobile',
    test: (_c, text) => /phone|call|mobile|field|on.site|driving|truck/i.test(text),
    generate: (c) => ({
      title: `Voice-first / mobile-native ${c.jobToBeDone}`,
      explanation: `${c.targetBuyer}s are often away from a desk (in the field, on calls, driving). Build a voice-controlled or mobile-native experience that works hands-free.`,
      feasibility: 6,
      impact: 7,
    }),
  },
  {
    wedgeType: 'sms-messaging',
    test: (_c, text) => /text|sms|message|notification|alert|remind/i.test(text),
    generate: (c) => ({
      title: `SMS-driven ${c.jobToBeDone}`,
      explanation: `Skip the app entirely. ${c.targetBuyer}s respond to texts, not emails. Build the entire workflow around SMS/messaging as the primary interface.`,
      feasibility: 8,
      impact: 6,
    }),
  },
];

export function generateWedges(candidate: OpportunityCandidate): PurpleOpportunity[] {
  const market = candidate.marketStructure;

  // Only generate wedges for purple or red ocean markets
  if (market && market.type === 'blue') {
    return [{
      wedgeType: 'first-mover',
      title: `First dedicated ${candidate.jobToBeDone} solution`,
      explanation: 'Blue ocean — no clear competitors exist. Focus on being first to market with a focused, opinionated solution rather than differentiation.',
      feasibility: 8,
      impact: 9,
    }];
  }

  const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
  const wedges: PurpleOpportunity[] = [];

  for (const template of WEDGE_TEMPLATES) {
    if (template.test(candidate, allText)) {
      const result = template.generate(candidate);
      wedges.push({
        wedgeType: template.wedgeType,
        ...result,
      });
    }
  }

  // Sort by impact × feasibility and return top 4
  return wedges
    .sort((a, b) => (b.impact * b.feasibility) - (a.impact * a.feasibility))
    .slice(0, 4);
}
