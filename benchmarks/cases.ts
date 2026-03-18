// Benchmark calibration cases.
// These are the objective referee for all system changes.

import { BenchmarkCase, makeCandidate, makeEvidence } from './benchmark-runner';

export const BENCHMARK_CASES: BenchmarkCase[] = [
  // ──────────────────────────────────────────────────────────────────
  // CASE 1: Missed call recovery (HOME-SERVICES, HIGH)
  // A strong purple opportunity — clear pain, buyers with money, weak incumbents
  // ──────────────────────────────────────────────────────────────────
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
        unitEconomics: 7, founderFit: 7, defensibility: 5,
      },
    }),
    expect: { minScore: 6.5, ocean: 'purple', minConfidence: 40, minROI: 2 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 2: Legal intake automation (HIGH)
  // High ability-to-pay vertical, clear pain, moderate competition
  // ──────────────────────────────────────────────────────────────────
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
        unitEconomics: 7, founderFit: 5, defensibility: 4,
      },
    }),
    expect: { minScore: 6, ocean: 'purple', minConfidence: 35 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 3: AI resume generator (LOW -- crowded)
  // Should score low: commoditized, too many competitors, low pain
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'ai-resume-generator',
    name: 'AI resume generator (LOW -- crowded)',
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
        unitEconomics: 2, founderFit: 4, defensibility: 1,
      },
      riskFlags: [
        { id: 'hype-driven-ai', severity: 'high', description: 'Commoditized AI product' },
        { id: 'crowded-market-no-wedge', severity: 'medium', description: 'Too many competitors' },
      ],
    }),
    expect: { maxScore: 4, ocean: 'red', maxContradictions: 30 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 4: Review response automation (MEDIUM-HIGH)
  // Decent opportunity but not exceptional
  // ──────────────────────────────────────────────────────────────────
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
        unitEconomics: 6, founderFit: 6, defensibility: 4,
      },
    }),
    expect: { minScore: 5, ocean: 'purple', minConfidence: 30 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 5: HVAC dispatch assistant (MEDIUM-HIGH)
  // Strong workflow anchor, good vertical
  // ──────────────────────────────────────────────────────────────────
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
        unitEconomics: 6, founderFit: 6, defensibility: 5,
      },
    }),
    expect: { minScore: 5.5, ocean: 'purple', minConfidence: 30 },
  },

  // ══════════════════════════════════════════════════════════════════
  //  NEW CASES (6-12) — expanded coverage
  // ══════════════════════════════════════════════════════════════════

  // ──────────────────────────────────────────────────────────────────
  // CASE 6: Blue ocean — AI safety audit for small manufacturers
  // Nascent market, almost no competitors, emerging regulation driving demand
  // Should score HIGH and classify BLUE
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'ai-safety-audit-manufacturing',
    name: 'AI safety audit for small manufacturers (BLUE OCEAN)',
    candidate: makeCandidate({
      vertical: 'manufacturing',
      jobToBeDone: 'automate OSHA safety compliance audits using computer vision',
      targetBuyer: 'Small manufacturing plant manager',
      evidence: [
        ...makeEvidence(4, { source: 'Reddit: r/manufacturing', signalType: 'pain', excerpt: 'OSHA fines are killing us, we had a $70k penalty last year. No good solution exists for small shops to stay compliant. Manual audits cost thousands each time' }),
        ...makeEvidence(3, { source: 'Reddit: r/OSHA', signalType: 'demand', excerpt: 'New regulations coming in 2026 will require more frequent safety audits. Small manufacturers have no affordable way to handle this. Growing demand for automation' }),
        ...makeEvidence(2, { source: 'Indeed: safety officer', signalType: 'money', excerpt: 'Hiring safety compliance officer $65k-$85k annually for manufacturing facility' }),
        ...makeEvidence(2, { source: 'Google Pricing', signalType: 'money', excerpt: 'Safety audit consulting $2000-$5000 per visit for small manufacturers' }),
      ],
      competitors: [
        { name: 'SafetyCulture', weaknesses: ['checklist only', 'no AI vision', 'no automated detection'], pricingRange: '$19-49/user/mo' },
      ],
      detectorScores: {
        demand: 8, painIntensity: 8, abilityToPay: 8, competitionWeakness: 9,
        easeToBuild: 4, distributionAccess: 5, workflowAnchor: 7,
        marketTiming: 9, revenueDensity: 7, aiAdvantage: 9, switchingFriction: 2, marketExpansion: 7,
        unitEconomics: 7, founderFit: 4, defensibility: 7,
      },
    }),
    expect: { minScore: 6.5, ocean: 'blue', minConfidence: 30 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 7: Commodity SaaS — yet another CRM
  // Mature market, high feature overlap, dozens of competitors, should score LOW
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'commodity-crm',
    name: 'Another CRM for small businesses (LOW -- commodity)',
    candidate: makeCandidate({
      vertical: 'general',
      jobToBeDone: 'manage customer relationships and sales pipeline',
      targetBuyer: 'Small business owner',
      evidence: [
        ...makeEvidence(3, { source: 'G2: CRM category', signalType: 'competition', excerpt: 'There are hundreds of CRM tools. Salesforce, HubSpot, Pipedrive, Zoho, Monday, Freshsales all offer dashboard analytics reporting integrations api automation. Commoditized mature saturated market' }),
        ...makeEvidence(2, { source: 'Reddit: r/smallbusiness', signalType: 'demand', excerpt: 'What CRM should I use? There are so many options. HubSpot free tier is good enough for most small businesses. Established market with many competitors' }),
        ...makeEvidence(2, { source: 'Reddit: r/startups', signalType: 'competition', excerpt: 'Building another CRM is the worst startup idea. The market is commoditized, price war between dozens of incumbents. Standard functionality, table stakes features everywhere' }),
      ],
      competitors: Array.from({ length: 20 }, (_, i) => ({
        name: ['Salesforce', 'HubSpot', 'Pipedrive', 'Zoho', 'Monday', 'Freshsales', 'Copper', 'Close', 'Insightly', 'Nimble', 'Streak', 'Agile', 'Nutshell', 'Capsule', 'Less Annoying', 'Bigin', 'EngageBay', 'Teamgate', 'Vtiger', 'SuiteCRM'][i] ?? `CRM${i}`,
        weaknesses: ['commoditized'],
        pricingRange: '$0-300/mo',
      })),
      detectorScores: {
        demand: 7, painIntensity: 3, abilityToPay: 4, competitionWeakness: 1,
        easeToBuild: 4, distributionAccess: 2, workflowAnchor: 5,
        marketTiming: 2, revenueDensity: 3, aiAdvantage: 2, switchingFriction: 7, marketExpansion: 2,
        unitEconomics: 3, founderFit: 3, defensibility: 2,
      },
    }),
    expect: { maxScore: 4, ocean: 'red', maxContradictions: 30 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 8: High demand, low willingness to pay — social media scheduling for creators
  // Lots of demand signals but buyers are price-sensitive individuals, not businesses
  // Should score MEDIUM at best, and flag the demand/pay contradiction
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'social-media-scheduler-creators',
    name: 'Social media scheduler for individual creators (MEDIUM-LOW)',
    candidate: makeCandidate({
      vertical: 'creator-economy',
      jobToBeDone: 'schedule and auto-post content across social media platforms',
      targetBuyer: 'Individual content creator',
      evidence: [
        ...makeEvidence(5, { source: 'Reddit: r/socialmedia', signalType: 'demand', excerpt: 'I need a tool to schedule posts across TikTok, Instagram, and YouTube. Growing demand among creators for cross-platform scheduling. Trending topic' }),
        ...makeEvidence(3, { source: 'Reddit: r/contentcreation', signalType: 'pain', excerpt: 'Spending hours manually posting to each platform is tedious time waste. Need automation but cant afford $50/mo tools on creator budget' }),
        ...makeEvidence(2, { source: 'Product Hunt', signalType: 'competition', excerpt: 'Buffer, Hootsuite, Later, Sprout Social all offer similar scheduling. New tools launch weekly' }),
        ...makeEvidence(1, { source: 'Google Pricing', signalType: 'money', excerpt: 'Social media tools $0-15/mo for individuals, $49-199/mo for businesses' }),
      ],
      competitors: [
        { name: 'Buffer', weaknesses: ['limited free tier'], pricingRange: '$0-15/mo' },
        { name: 'Hootsuite', weaknesses: ['expensive'], pricingRange: '$49-199/mo' },
        { name: 'Later', weaknesses: ['Instagram focused'], pricingRange: '$0-25/mo' },
        { name: 'Sprout Social', weaknesses: ['enterprise pricing'], pricingRange: '$249/mo' },
      ],
      detectorScores: {
        demand: 8, painIntensity: 5, abilityToPay: 2, competitionWeakness: 3,
        easeToBuild: 6, distributionAccess: 5, workflowAnchor: 6,
        marketTiming: 5, revenueDensity: 2, aiAdvantage: 3, switchingFriction: 2, marketExpansion: 4,
        unitEconomics: 3, founderFit: 5, defensibility: 3,
      },
    }),
    expect: { maxScore: 5, ocean: 'purple', minConfidence: 25 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 9: Strong demand, terrible distribution — AI diagnostics for rural veterinarians
  // Real problem, buyers exist, but reaching them is extremely hard
  // Should score MEDIUM
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'rural-vet-ai-diagnostics',
    name: 'AI diagnostics for rural veterinarians (MEDIUM -- distribution problem)',
    candidate: makeCandidate({
      vertical: 'veterinary',
      jobToBeDone: 'assist rural vets with AI-powered diagnostic imaging analysis',
      targetBuyer: 'Rural veterinary practice owner',
      evidence: [
        ...makeEvidence(4, { source: 'Reddit: r/veterinary', signalType: 'pain', excerpt: 'As a rural vet I see cases I am not sure about with no specialist nearby. Losing revenue from referrals I could handle with better diagnostics' }),
        ...makeEvidence(3, { source: 'Reddit: r/vettech', signalType: 'demand', excerpt: 'AI diagnostic tools would be amazing for rural practices. Growing demand but no one is building for small rural clinics specifically' }),
        ...makeEvidence(2, { source: 'Indeed: veterinary', signalType: 'money', excerpt: 'Veterinary diagnostic equipment $5000-$50000 per unit. Rural practices budget constrained' }),
        ...makeEvidence(1, { source: 'Google Pricing', signalType: 'money', excerpt: 'Veterinary AI diagnostic platforms $200-$500/mo, require internet connectivity' }),
      ],
      competitors: [
        { name: 'SignalPET', weaknesses: ['urban focused', 'requires fast internet'], pricingRange: '$200-400/mo' },
        { name: 'Vetology', weaknesses: ['limited species', 'expensive'], pricingRange: '$300-500/mo' },
      ],
      detectorScores: {
        demand: 7, painIntensity: 7, abilityToPay: 5, competitionWeakness: 6,
        easeToBuild: 3, distributionAccess: 2, workflowAnchor: 7,
        marketTiming: 6, revenueDensity: 5, aiAdvantage: 8, switchingFriction: 3, marketExpansion: 4,
        unitEconomics: 5, founderFit: 3, defensibility: 5,
      },
    }),
    expect: { minScore: 4.5, maxScore: 6.5, ocean: 'blue', minConfidence: 25 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 10: Two-sided marketplace — freelance lab technicians
  // Marketplace dynamics: chicken-and-egg problem, high complexity
  // Should score MEDIUM and flag marketplace risks
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'freelance-lab-tech-marketplace',
    name: 'Freelance lab technician marketplace (MEDIUM -- marketplace complexity)',
    candidate: makeCandidate({
      vertical: 'healthcare',
      jobToBeDone: 'connect labs with freelance lab technicians for overflow work',
      targetBuyer: 'Clinical laboratory manager',
      evidence: [
        ...makeEvidence(3, { source: 'Reddit: r/medlabprofessionals', signalType: 'pain', excerpt: 'We are critically understaffed. Losing revenue because we cant process enough samples. Hiring full time takes months' }),
        ...makeEvidence(3, { source: 'Reddit: r/labrats', signalType: 'demand', excerpt: 'Would love flexible lab tech gig work. Many of us want part-time work at multiple labs. Growing demand for flexible staffing' }),
        ...makeEvidence(2, { source: 'Indeed: lab technician', signalType: 'money', excerpt: 'Temp lab staffing agencies charge $45-65/hr. Lab technician salary $55k-$75k' }),
        ...makeEvidence(2, { source: 'Google Pricing', signalType: 'money', excerpt: 'Healthcare staffing platform fees 15-25% markup. Lab staffing $60-80/hr billed rate' }),
      ],
      competitors: [
        { name: 'Vivian Health', weaknesses: ['nursing focused', 'not lab specific'], pricingRange: '15-20% markup' },
        { name: 'Lab Staffing agencies', weaknesses: ['slow', 'expensive', 'manual'], pricingRange: '25-40% markup' },
        { name: 'Indeed/LinkedIn', weaknesses: ['not specialized', 'no credentialing'], pricingRange: 'Free-$500/post' },
      ],
      detectorScores: {
        demand: 7, painIntensity: 7, abilityToPay: 6, competitionWeakness: 5,
        easeToBuild: 3, distributionAccess: 4, workflowAnchor: 5,
        marketTiming: 6, revenueDensity: 6, aiAdvantage: 3, switchingFriction: 3, marketExpansion: 5,
        unitEconomics: 5, founderFit: 3, defensibility: 4,
      },
      riskFlags: [
        { id: 'marketplace-chicken-egg', severity: 'high', description: 'Two-sided marketplace: need both labs and technicians simultaneously' },
        { id: 'regulatory-complexity', severity: 'medium', description: 'Lab work requires CLIA certification and state licensing' },
      ],
    }),
    expect: { minScore: 4.5, maxScore: 6, ocean: 'purple', minConfidence: 25 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 11: Declining market — print shop management software
  // Market is shrinking, not growing. Should score LOW.
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'print-shop-management',
    name: 'Print shop management software (LOW -- declining market)',
    candidate: makeCandidate({
      vertical: 'print',
      jobToBeDone: 'manage orders, inventory, and production for commercial print shops',
      targetBuyer: 'Print shop owner',
      evidence: [
        ...makeEvidence(2, { source: 'Reddit: r/commercialprinting', signalType: 'pain', excerpt: 'Still using spreadsheets to track orders but our volume is declining every year. Print industry is dying, replaced by digital' }),
        ...makeEvidence(2, { source: 'Reddit: r/smallbusiness', signalType: 'demand', excerpt: 'Any software for managing a print shop? Most tools are outdated. Market is declining and obsolete, fewer shops every year' }),
        ...makeEvidence(1, { source: 'Google Pricing', signalType: 'money', excerpt: 'Print MIS software $100-$300/mo. Market shrinking as print volumes decline' }),
      ],
      competitors: [
        { name: 'PrintSmith', weaknesses: ['legacy', 'outdated'], pricingRange: '$200-400/mo' },
        { name: 'EFI Pace', weaknesses: ['enterprise only', 'expensive'], pricingRange: '$500+/mo' },
        { name: 'Ordant', weaknesses: ['limited features'], pricingRange: '$99-199/mo' },
      ],
      detectorScores: {
        demand: 3, painIntensity: 4, abilityToPay: 4, competitionWeakness: 5,
        easeToBuild: 5, distributionAccess: 4, workflowAnchor: 6,
        marketTiming: 2, revenueDensity: 3, aiAdvantage: 2, switchingFriction: 6, marketExpansion: 1,
        unitEconomics: 4, founderFit: 4, defensibility: 3,
      },
    }),
    expect: { maxScore: 4.5, ocean: 'purple', minConfidence: 20 },
  },

  // ──────────────────────────────────────────────────────────────────
  // CASE 12: Niche B2B — AI-powered permit expediting for contractors
  // Narrow niche with real money, clear pain, and an AI wedge
  // Should score HIGH purple
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'permit-expediting-ai',
    name: 'AI permit expediting for contractors (HIGH -- niche B2B)',
    candidate: makeCandidate({
      vertical: 'construction',
      jobToBeDone: 'automate building permit applications and track approval status',
      targetBuyer: 'General contractor or construction project manager',
      evidence: [
        ...makeEvidence(4, { source: 'Reddit: r/construction', signalType: 'pain', excerpt: 'Permit delays cost us thousands per week in lost revenue. Manual paperwork takes hours, losing money every day we wait. Missed deadlines from slow permit processing' }),
        ...makeEvidence(3, { source: 'Reddit: r/contractors', signalType: 'demand', excerpt: 'Would pay good money for something that automates permit filing. Currently hiring someone at $25/hr just to handle permits. Growing demand for construction tech' }),
        ...makeEvidence(3, { source: 'Indeed: permit coordinator', signalType: 'money', excerpt: 'Hiring permit coordinator $50k-$70k annually. Construction firms spending $2000-5000/mo on permit expediting services' }),
        ...makeEvidence(2, { source: 'Google Pricing', signalType: 'money', excerpt: 'Permit expediting services charge $500-$2000 per permit. Software solutions $99-$299/mo' }),
      ],
      competitors: [
        { name: 'PermitFlow', weaknesses: ['limited municipalities', 'no AI'], pricingRange: '$199-499/mo' },
        { name: 'Permit.com', weaknesses: ['manual service', 'slow'], pricingRange: '$500-2000/permit' },
      ],
      detectorScores: {
        demand: 8, painIntensity: 8, abilityToPay: 8, competitionWeakness: 7,
        easeToBuild: 5, distributionAccess: 6, workflowAnchor: 8,
        marketTiming: 7, revenueDensity: 7, aiAdvantage: 7, switchingFriction: 3, marketExpansion: 6,
        unitEconomics: 7, founderFit: 6, defensibility: 6,
      },
    }),
    expect: { minScore: 6.5, ocean: 'blue', minConfidence: 35, minROI: 2 },
  },
];

// ══════════════════════════════════════════════════════════════════════
// END-TO-END DETECTOR BENCHMARK CASES
// These cases feed raw evidence and let detectors compute scores from scratch.
// They test the full pipeline: evidence -> detectors -> scoring -> classification.
// ══════════════════════════════════════════════════════════════════════

export const E2E_BENCHMARK_CASES: BenchmarkCase[] = [
  // ──────────────────────────────────────────────────────────────────
  // E2E CASE 1: Strong opportunity — detectors should produce high scores
  // Evidence is rich with pain, demand, money signals + competitor weaknesses
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'e2e-strong-opportunity',
    name: 'E2E: Strong opportunity with rich evidence',
    candidate: makeCandidate({
      vertical: 'home-services',
      jobToBeDone: 'automate appointment booking from missed calls',
      targetBuyer: 'Plumbing company owner',
      evidence: [
        // Demand signals (diverse sources, growth keywords)
        { source: 'Reddit: r/plumbing', url: 'https://reddit.com/1', excerpt: 'Need a system to catch missed calls. Growing problem as we get busier, increasing demand every month', signalType: 'demand', sourceTier: 2, confidence: 0.8, timestamp: Date.now() - 5 * 86400000 },
        { source: 'Reddit: r/hvac', url: 'https://reddit.com/2', excerpt: 'Looking for missed call recovery tool, this is a breakout category trending upward', signalType: 'demand', sourceTier: 2, confidence: 0.7, timestamp: Date.now() - 10 * 86400000 },
        { source: 'Google Trends', url: 'https://trends.google.com/1', excerpt: 'Missed call software for contractors showing growing yoy search volume', signalType: 'demand', sourceTier: 1, confidence: 0.9, timestamp: Date.now() - 2 * 86400000 },
        // Pain signals (revenue loss + time waste)
        { source: 'Reddit: r/smallbusiness', url: 'https://reddit.com/3', excerpt: 'Losing thousands in revenue from missed calls every month, this is killing my plumbing business', signalType: 'pain', sourceTier: 2, confidence: 0.8, timestamp: Date.now() - 7 * 86400000 },
        { source: 'Reddit: r/contractors', url: 'https://reddit.com/4', excerpt: 'I waste hours calling people back who already booked someone else. Manual follow-up is tedious', signalType: 'pain', sourceTier: 2, confidence: 0.7, timestamp: Date.now() - 15 * 86400000 },
        { source: 'Reddit: r/plumbing', url: 'https://reddit.com/5', excerpt: 'Missed a $5000 job because I was on another call. Cost me so much revenue', signalType: 'pain', sourceTier: 2, confidence: 0.8, timestamp: Date.now() - 3 * 86400000 },
        // Money signals
        { source: 'Indeed: receptionist', url: 'https://indeed.com/1', excerpt: 'Hiring receptionist $18/hr full-time to handle inbound calls and booking for plumbing company', signalType: 'money', sourceTier: 2, confidence: 0.7, timestamp: Date.now() - 20 * 86400000 },
        { source: 'Google Pricing', url: 'https://pricing.com/1', excerpt: 'Call answering services $200-500/mo. AI call handling $79-299/mo per location', signalType: 'money', sourceTier: 1, confidence: 0.9, timestamp: Date.now() - 5 * 86400000 },
        // Competition signals (weak competitors)
        { source: 'G2: ServiceTitan reviews', url: 'https://g2.com/1', excerpt: 'ServiceTitan is overpriced and clunky for small shops. 3.5/5 rating. Poor support, outdated interface, frustrating to use', signalType: 'competition', sourceTier: 1, confidence: 0.9, timestamp: Date.now() - 10 * 86400000 },
        { source: 'G2: Jobber reviews', url: 'https://g2.com/2', excerpt: 'Jobber has no AI features, everything is manual. Basic tool that hasnt been updated in years, outdated', signalType: 'competition', sourceTier: 1, confidence: 0.8, timestamp: Date.now() - 12 * 86400000 },
      ],
      competitors: [
        { name: 'ServiceTitan', weaknesses: ['overpriced', 'clunky', 'poor support'], pricingRange: '$200-400/mo', reviewScore: 3.5 },
        { name: 'Jobber', weaknesses: ['no AI', 'manual', 'outdated'], pricingRange: '$50-100/mo' },
      ],
      // Intentionally NOT providing detectorScores — detectors will compute them
    }),
    expect: { minScore: 5, ocean: 'blue', minConfidence: 30 },
  },

  // ──────────────────────────────────────────────────────────────────
  // E2E CASE 2: Weak opportunity — detectors should produce low scores
  // Sparse evidence, no real pain, crowded commoditized market
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'e2e-weak-opportunity',
    name: 'E2E: Weak opportunity with thin evidence',
    candidate: makeCandidate({
      vertical: 'general',
      jobToBeDone: 'create to-do lists with AI',
      targetBuyer: 'General consumer',
      evidence: [
        { source: 'Reddit: r/productivity', url: 'https://reddit.com/10', excerpt: 'Yet another to-do app. There are hundreds of these, saturated crowded market. Commoditized space with many competitors', signalType: 'competition', sourceTier: 2, confidence: 0.6, timestamp: Date.now() - 60 * 86400000 },
        { source: 'Product Hunt', url: 'https://producthunt.com/1', excerpt: 'AI to-do list app. Features include templates, export, similar to Todoist versus TickTick versus Things versus Any.do. Standard functionality', signalType: 'competition', sourceTier: 2, confidence: 0.5, timestamp: Date.now() - 45 * 86400000 },
        { source: 'Reddit: r/apps', url: 'https://reddit.com/11', excerpt: 'Looking for a to-do app recommendation. Use Todoist free tier, works fine for most people', signalType: 'demand', sourceTier: 3, confidence: 0.4, timestamp: Date.now() - 90 * 86400000 },
      ],
      competitors: Array.from({ length: 12 }, (_, i) => ({
        name: ['Todoist', 'TickTick', 'Things', 'Any.do', 'Microsoft To Do', 'Google Tasks', 'Notion', 'Asana', 'Trello', 'Monday', 'Clickup', 'Omnifocus'][i] ?? `Todo${i}`,
        weaknesses: ['commoditized'],
        pricingRange: '$0-10/mo',
      })),
    }),
    expect: { maxScore: 4.5, ocean: 'purple' },
  },

  // ──────────────────────────────────────────────────────────────────
  // E2E CASE 3: Contradiction case — high demand but no ability to pay
  // Should trigger the demand/pay contradiction rule
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'e2e-contradiction-demand-pay',
    name: 'E2E: High demand but no money (should flag contradiction)',
    candidate: makeCandidate({
      vertical: 'education',
      jobToBeDone: 'provide AI tutoring for K-12 students',
      targetBuyer: 'Parent of school-age child',
      evidence: [
        // Lots of demand
        { source: 'Reddit: r/parenting', url: 'https://reddit.com/20', excerpt: 'My kid needs help with math but tutors are too expensive. Growing demand for affordable AI tutoring, increasing every year', signalType: 'demand', sourceTier: 2, confidence: 0.8, timestamp: Date.now() - 5 * 86400000 },
        { source: 'Reddit: r/education', url: 'https://reddit.com/21', excerpt: 'Teachers overwhelmed, kids falling behind. Need scalable tutoring solutions. Breakout demand in edtech trending upward', signalType: 'demand', sourceTier: 2, confidence: 0.7, timestamp: Date.now() - 8 * 86400000 },
        { source: 'Reddit: r/homeschool', url: 'https://reddit.com/22', excerpt: 'Looking for AI learning tools for my kids. Every parent I know wants this. Growing market', signalType: 'demand', sourceTier: 2, confidence: 0.7, timestamp: Date.now() - 12 * 86400000 },
        { source: 'Google Trends', url: 'https://trends.google.com/2', excerpt: 'AI tutoring searches up 300% year over year, growing fast', signalType: 'demand', sourceTier: 1, confidence: 0.9, timestamp: Date.now() - 2 * 86400000 },
        // Very little money signal — price-sensitive buyers
        { source: 'Reddit: r/parenting', url: 'https://reddit.com/23', excerpt: 'Would use AI tutoring but cant afford another subscription. Already paying for too many things', signalType: 'pain', sourceTier: 2, confidence: 0.6, timestamp: Date.now() - 10 * 86400000 },
      ],
      competitors: [
        { name: 'Khan Academy', weaknesses: ['not AI-powered'], pricingRange: 'Free' },
        { name: 'Khanmigo', weaknesses: ['limited', 'new'], pricingRange: '$44/year' },
        { name: 'Photomath', weaknesses: ['math only'], pricingRange: '$0-10/mo' },
      ],
      detectorScores: {
        demand: 9, painIntensity: 5, abilityToPay: 2, competitionWeakness: 4,
        easeToBuild: 5, distributionAccess: 6, workflowAnchor: 6,
        marketTiming: 8, revenueDensity: 2, aiAdvantage: 5, switchingFriction: 2, marketExpansion: 7,
        unitEconomics: 3, founderFit: 5, defensibility: 3,
      },
    }),
    expect: { maxScore: 5.5, ocean: 'purple', minConfidence: 20 },
  },
];
