// Benchmark calibration cases.
// These are the objective referee for all system changes.

import { BenchmarkCase, makeCandidate, makeEvidence } from './benchmark-runner';

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'missed-call-recovery',
    name: 'Missed call recovery for home services (HIGH)',
    candidate: makeCandidate({
      vertical: 'home-services',
      jobToBeDone: 'recover missed calls and convert to booked jobs',
      targetBuyer: 'Plumbing / HVAC contractor',
      evidence: [
        ...makeEvidence(5, { source: 'Reddit: r/plumbing', signalType: 'pain', excerpt: 'I miss so many calls when Im on a job, losing thousands in revenue every month' }),
        ...makeEvidence(3, { source: 'G2: ServiceTitan reviews', signalType: 'competition', excerpt: 'ServiceTitan is overpriced and clunky, too expensive for small shops' }),
        ...makeEvidence(4, { source: 'Indeed: job posting', signalType: 'money', excerpt: 'Hiring receptionist $18/hr to answer missed calls and schedule appointments' }),
        ...makeEvidence(2, { source: 'Google Pricing', signalType: 'money', excerpt: 'Missed call software pricing $79/mo to $299/mo per location' }),
      ],
      competitors: [
        { name: 'ServiceTitan', weaknesses: ['expensive', 'complex'], pricingRange: '$200-400/mo' },
        { name: 'Jobber', weaknesses: ['no AI', 'manual'], pricingRange: '$50-100/mo' },
      ],
      detectorScores: {
        demand: 8, painIntensity: 8, abilityToPay: 7, competitionWeakness: 7,
        easeToBuild: 7, distributionAccess: 7, workflowAnchor: 8,
        marketTiming: 7, revenueDensity: 7, aiAdvantage: 6, switchingFriction: 3, marketExpansion: 6,
      },
    }),
    expect: { minScore: 6.5, ocean: 'purple', minConfidence: 40, minROI: 2 },
  },
  {
    id: 'legal-intake',
    name: 'Legal intake automation (HIGH)',
    candidate: makeCandidate({
      vertical: 'legal',
      jobToBeDone: 'automate client intake and qualification',
      targetBuyer: 'Small law firm partner',
      evidence: [
        ...makeEvidence(4, { source: 'Reddit: r/lawyers', signalType: 'pain', excerpt: 'We waste hours on intake calls that go nowhere, need better qualification' }),
        ...makeEvidence(3, { source: 'G2: Clio reviews', signalType: 'competition', excerpt: 'Clio intake is basic and outdated, no AI qualification' }),
        ...makeEvidence(3, { source: 'Indeed: legal tech', signalType: 'money', excerpt: 'Legal intake software $149-$299/mo for small firms' }),
      ],
      competitors: [
        { name: 'Clio', weaknesses: ['outdated intake', 'no AI'], pricingRange: '$99-199/mo' },
        { name: 'LawMatics', weaknesses: ['complex setup', 'expensive'], pricingRange: '$149-299/mo' },
      ],
      detectorScores: {
        demand: 7, painIntensity: 7, abilityToPay: 8, competitionWeakness: 6,
        easeToBuild: 6, distributionAccess: 6, workflowAnchor: 7,
        marketTiming: 6, revenueDensity: 8, aiAdvantage: 5, switchingFriction: 4, marketExpansion: 5,
      },
    }),
    expect: { minScore: 6, ocean: 'purple', minConfidence: 35 },
  },
  {
    id: 'ai-resume-generator',
    name: 'AI resume generator (LOW — crowded)',
    candidate: makeCandidate({
      vertical: 'general',
      jobToBeDone: 'generate resumes using AI',
      targetBuyer: 'Job seeker',
      evidence: [
        ...makeEvidence(3, { source: 'Product Hunt', signalType: 'competition', excerpt: 'Another AI resume builder launched today, there are dozens of these now. Features include templates, export, analytics dashboard, similar to Kickresume versus Novoresume' }),
        ...makeEvidence(2, { source: 'Reddit: r/resumes', signalType: 'demand', excerpt: 'Any good AI resume generators? Tried five already, they all offer the same templates and formatting. Saturated crowded market with many competitors' }),
        ...makeEvidence(2, { source: 'Reddit: r/startups', signalType: 'competition', excerpt: 'The AI resume space is a red ocean, dozens of competitors like Rezi, Teal, Kickresume, all offering the same features. Commoditized market, standard functionality' }),
      ],
      competitors: Array.from({ length: 15 }, (_, i) => ({
        name: `ResumeAI${i}`,
        weaknesses: ['commoditized'],
        pricingRange: '$10-20/mo',
      })),
      detectorScores: {
        demand: 6, painIntensity: 3, abilityToPay: 2, competitionWeakness: 2,
        easeToBuild: 8, distributionAccess: 3, workflowAnchor: 2,
        marketTiming: 3, revenueDensity: 2, aiAdvantage: 2, switchingFriction: 1, marketExpansion: 2,
      },
      riskFlags: [
        { id: 'hype-driven-ai', severity: 'high', description: 'Commoditized AI product' },
        { id: 'crowded-market-no-wedge', severity: 'medium', description: 'Too many competitors' },
      ],
    }),
    expect: { maxScore: 4, ocean: 'red', maxContradictions: 30 },
  },
  {
    id: 'review-response-automation',
    name: 'Local business review response automation (MEDIUM-HIGH)',
    candidate: makeCandidate({
      vertical: 'home-services',
      jobToBeDone: 'automatically respond to Google reviews',
      targetBuyer: 'Local business owner',
      evidence: [
        ...makeEvidence(4, { source: 'Reddit: r/smallbusiness', signalType: 'pain', excerpt: 'I never have time to respond to reviews, they pile up and hurt my rating' }),
        ...makeEvidence(3, { source: 'Google Pricing', signalType: 'money', excerpt: 'Review management tools $49-$199/mo for local businesses' }),
        ...makeEvidence(2, { source: 'G2: Birdeye', signalType: 'competition', excerpt: 'Birdeye is too expensive for small shops, $299/mo minimum' }),
      ],
      competitors: [
        { name: 'Birdeye', weaknesses: ['expensive', 'complex'], pricingRange: '$299-499/mo' },
        { name: 'Podium', weaknesses: ['expensive'], pricingRange: '$399/mo' },
        { name: 'Grade.us', weaknesses: ['manual', 'no AI'], pricingRange: '$90-180/mo' },
      ],
      detectorScores: {
        demand: 7, painIntensity: 6, abilityToPay: 6, competitionWeakness: 6,
        easeToBuild: 7, distributionAccess: 6, workflowAnchor: 6,
        marketTiming: 6, revenueDensity: 5, aiAdvantage: 5, switchingFriction: 3, marketExpansion: 5,
      },
    }),
    expect: { minScore: 5, ocean: 'purple', minConfidence: 30 },
  },
  {
    id: 'hvac-dispatch',
    name: 'HVAC dispatch assistant (MEDIUM-HIGH)',
    candidate: makeCandidate({
      vertical: 'home-services',
      jobToBeDone: 'optimize HVAC technician dispatch and routing',
      targetBuyer: 'HVAC company owner',
      evidence: [
        ...makeEvidence(3, { source: 'Reddit: r/hvac', signalType: 'pain', excerpt: 'Our dispatcher is overwhelmed, we waste so much time on routing and scheduling' }),
        ...makeEvidence(2, { source: 'Indeed: HVAC dispatcher', signalType: 'money', excerpt: 'Hiring HVAC dispatcher $22/hr full time to manage technician schedules' }),
        ...makeEvidence(2, { source: 'G2: ServiceTitan', signalType: 'competition', excerpt: 'ServiceTitan dispatch is clunky and outdated, manual drag and drop' }),
      ],
      competitors: [
        { name: 'ServiceTitan', weaknesses: ['clunky dispatch', 'expensive'], pricingRange: '$200-400/mo' },
        { name: 'Housecall Pro', weaknesses: ['basic routing', 'no optimization'], pricingRange: '$65-169/mo' },
      ],
      detectorScores: {
        demand: 6, painIntensity: 7, abilityToPay: 7, competitionWeakness: 6,
        easeToBuild: 5, distributionAccess: 6, workflowAnchor: 8,
        marketTiming: 6, revenueDensity: 6, aiAdvantage: 6, switchingFriction: 5, marketExpansion: 5,
      },
    }),
    expect: { minScore: 5.5, ocean: 'purple', minConfidence: 30 },
  },
];
