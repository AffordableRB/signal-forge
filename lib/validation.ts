import { OpportunityCandidate } from './types';

export interface ValidationPlan {
  interviewQuestions: string[];
  outreachMessages: { label: string; message: string }[];
  experiments: { label: string; description: string }[];
  schedule: { days: string; task: string }[];
}

export function generateValidationPlan(c: OpportunityCandidate): ValidationPlan {
  const buyer = c.targetBuyer;
  const job = c.jobToBeDone;
  const vertical = c.vertical;
  const painExcerpt = c.evidence.find(e => e.signalType === 'pain')?.excerpt ?? 'the core problem';

  return {
    interviewQuestions: [
      `How are you currently handling ${job}? Walk me through your process.`,
      `What's the biggest cost of this problem -- time, money, or missed opportunities?`,
      `If a tool solved this completely, what would you pay monthly? What would make you cancel?`,
    ],
    outreachMessages: [
      {
        label: 'Cold DM (Reddit/LinkedIn)',
        message: `Hey -- I keep seeing ${buyer}s in ${vertical} struggling with ${job}. I'm exploring building a focused tool for this. Would you be open to a 10-min call to share what you've tried?`,
      },
      {
        label: 'Community Post',
        message: `We're researching how ${buyer}s handle ${job}. If you've dealt with this, I'd love to hear your biggest frustration. Building something to fix it.`,
      },
      {
        label: 'Direct Email',
        message: `Subject: Quick question about ${job}. I noticed ${painExcerpt.slice(0, 80)}. Is this something your team still deals with? I'm exploring solutions and would value your input.`,
      },
    ],
    experiments: [
      {
        label: 'Smoke test landing page',
        description: `Create a single page describing the solution for ${job}. Drive traffic via targeted Reddit/community posts. Measure email signups.`,
      },
      {
        label: 'Manual concierge',
        description: `Offer to solve ${job} manually for 3-5 ${buyer}s for free. Track time spent and willingness to pay after.`,
      },
      {
        label: 'Competitor audit',
        description: `Sign up for top 2 competitors. Document every friction point and missing feature. Share findings with prospects to gauge interest.`,
      },
    ],
    schedule: [
      { days: 'Day 1-2', task: 'Send 20 outreach messages. Post in 3 communities.' },
      { days: 'Day 3-4', task: 'Conduct 3-5 interviews. Document pain patterns.' },
      { days: 'Day 5', task: 'Build smoke test landing page. Set up analytics.' },
      { days: 'Day 6', task: 'Run competitor audit. Document gaps.' },
      { days: 'Day 7', task: 'Synthesize findings. Go/no-go decision.' },
    ],
  };
}
