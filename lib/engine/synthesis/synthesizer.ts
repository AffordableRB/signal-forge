import { OpportunityCandidate, StartupConcept, ValidationPlan } from '../models/types';

export function synthesizeStartupConcepts(candidate: OpportunityCandidate): StartupConcept[] {
  const wedges = candidate.purpleOpportunities ?? [];
  const concepts: StartupConcept[] = [];

  const buyer = candidate.targetBuyer;
  const job = candidate.jobToBeDone;
  const vertical = candidate.vertical;

  // Generate a concept for each wedge
  for (const wedge of wedges.slice(0, 3)) {
    const concept = buildConcept(candidate, wedge.wedgeType, wedge.title, buyer, job, vertical);
    if (concept) concepts.push(concept);
  }

  // Always generate a "core" concept based on the job itself
  if (concepts.length === 0) {
    concepts.push({
      name: formatName(job, vertical),
      oneLiner: `The simplest way for ${buyer}s to handle ${job}.`,
      wedge: 'Focused simplicity — do one thing extremely well.',
      technology: inferTechnology(candidate),
      goToMarket: inferGTM(candidate),
    });
  }

  return concepts;
}

function buildConcept(
  candidate: OpportunityCandidate,
  wedgeType: string,
  wedgeTitle: string,
  buyer: string,
  job: string,
  vertical: string,
): StartupConcept | null {
  const tech = inferTechnology(candidate);
  const gtm = inferGTM(candidate);

  switch (wedgeType) {
    case 'ai-disruption':
      return {
        name: `AI ${formatName(job, vertical)}`,
        oneLiner: `AI-powered ${job} that saves ${buyer}s hours every week.`,
        wedge: wedgeTitle,
        technology: `${tech}. Core AI: NLP classification + workflow automation.`,
        goToMarket: gtm,
      };
    case 'automation':
      return {
        name: `Auto${capitalize(extractKeyword(job))}`,
        oneLiner: `Automate ${job} end-to-end. Zero manual steps.`,
        wedge: wedgeTitle,
        technology: `${tech}. Event-driven automation with API integrations.`,
        goToMarket: gtm,
      };
    case 'segment-focus':
      return {
        name: formatName(job, vertical),
        oneLiner: `${capitalize(job)} built exclusively for ${vertical}.`,
        wedge: wedgeTitle,
        technology: `${tech}. Pre-built ${vertical} templates and workflows.`,
        goToMarket: gtm,
      };
    case 'workflow-redesign':
      return {
        name: `Simple${capitalize(extractKeyword(job))}`,
        oneLiner: `The ${job} tool that takes 5 minutes to learn.`,
        wedge: wedgeTitle,
        technology: `${tech}. Opinionated UX, guided workflows.`,
        goToMarket: gtm,
      };
    case 'pricing-disruption':
      return {
        name: formatName(job, vertical),
        oneLiner: `${capitalize(job)} at 1/3 the price of incumbents.`,
        wedge: wedgeTitle,
        technology: `${tech}. Lean architecture to maintain margins at low price.`,
        goToMarket: `${gtm}. Lead with free tier, convert on usage.`,
      };
    case 'voice-mobile':
      return {
        name: `Voice${capitalize(extractKeyword(job))}`,
        oneLiner: `Handle ${job} by voice or from your phone. No desk required.`,
        wedge: wedgeTitle,
        technology: `${tech}. Speech-to-text, mobile-first PWA.`,
        goToMarket: gtm,
      };
    case 'sms-messaging':
      return {
        name: `Text${capitalize(extractKeyword(job))}`,
        oneLiner: `${capitalize(job)} via text message. No app to download.`,
        wedge: wedgeTitle,
        technology: `${tech}. Twilio/SMS-based interface.`,
        goToMarket: gtm,
      };
    case 'first-mover':
      return {
        name: formatName(job, vertical),
        oneLiner: `The first dedicated ${job} platform for ${buyer}s.`,
        wedge: wedgeTitle,
        technology: tech,
        goToMarket: gtm,
      };
    default:
      return {
        name: formatName(job, vertical),
        oneLiner: `${capitalize(job)} reimagined for ${buyer}s.`,
        wedge: wedgeTitle,
        technology: tech,
        goToMarket: gtm,
      };
  }
}

function inferTechnology(candidate: OpportunityCandidate): string {
  const aiScore = candidate.detectorResults.find(r => r.detectorId === 'aiAdvantage')?.score ?? 0;
  const parts = ['Next.js + TypeScript SaaS'];
  if (aiScore >= 4) parts.push('AI/LLM integration');
  parts.push('REST API');
  return parts.join(', ');
}

function inferGTM(candidate: OpportunityCandidate): string {
  const distScore = candidate.detectorResults.find(r => r.detectorId === 'distributionAccess')?.score ?? 5;
  const vertical = candidate.vertical;

  if (['home-services', 'healthcare', 'legal'].includes(vertical)) {
    return 'Direct outreach to local businesses via directories + Google Ads on pain keywords';
  }
  if (distScore >= 7) {
    return 'Community-led growth: forums, subreddits, and niche directories';
  }
  return 'Content marketing on pain keywords + cold outreach to target buyers';
}

function formatName(job: string, vertical: string): string {
  const keyword = extractKeyword(job);
  const verticalPrefix = vertical !== 'general' ? capitalize(vertical.replace(/-/g, '')) : '';
  return `${verticalPrefix}${capitalize(keyword)}`.replace(/\s+/g, '');
}

function extractKeyword(job: string): string {
  const stopWords = new Set(['for', 'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'with', 'by']);
  const words = job.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2);
  return words.slice(0, 2).join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateValidationPlan(candidate: OpportunityCandidate): ValidationPlan {
  const buyer = candidate.targetBuyer;
  const job = candidate.jobToBeDone;
  const vertical = candidate.vertical;

  return {
    interviewQuestions: [
      `How do you currently handle ${job}? Walk me through your workflow.`,
      `What's the most frustrating part of this process?`,
      `How much time do you spend on this per week?`,
      `Have you tried any tools for this? What did you like/dislike?`,
      `If a tool could solve this perfectly, what would it do?`,
      `What would you pay monthly for a solution that saves you X hours/week?`,
      `Who else on your team is involved in this workflow?`,
    ],
    outreachMessages: [
      `Hi [Name], I noticed many ${buyer}s struggle with ${job}. I'm researching this problem — would you be open to a 15-min chat about your workflow? No sales pitch, just learning.`,
      `Hey [Name], I'm building a tool to help ${vertical} businesses with ${job}. I'd love to hear how you handle this today. Quick call this week?`,
      `[Name] — I saw your post about ${job}. I'm working on making this easier for ${buyer}s. Would love your input. 10 minutes?`,
    ],
    sevenDayPlan: [
      'Day 1: Identify 30 target buyers via LinkedIn/directories. Send 15 cold outreach messages.',
      'Day 2: Post in 3 relevant subreddits/forums asking about the problem. Monitor responses.',
      `Day 3: Conduct 2-3 discovery interviews with ${buyer}s. Record pain points and current spend.`,
      'Day 4: Analyze interview notes. Identify top 3 pain points and willingness-to-pay signals.',
      'Day 5: Build a landing page describing the solution. Set up waitlist form.',
      'Day 6: Run $50 Google Ads test on pain keywords. Measure click-through and signups.',
      'Day 7: Review all data. Decide go/no-go based on: interviews (pain confirmed?), ads (demand?), signups (willingness to act?).',
    ],
  };
}
