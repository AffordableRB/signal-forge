// Calibration cases for scoring accuracy.
// Each case is a known business outcome that we can scan for and compare
// our scores against reality.
//
// verdict: 'strong' = successful business (should score 7+)
//          'moderate' = viable but competitive (should score 5-7)
//          'weak' = poor opportunity (should score <5)

export interface CalibrationCase {
  id: string;
  topic: string;
  // The specific opportunity we expect to find
  expectedOpportunity: string;
  // Keywords that should appear in the job-to-be-done
  expectedKeywords: string[];
  // Known real-world outcome
  verdict: 'strong' | 'moderate' | 'weak';
  // Why this verdict
  reasoning: string;
  // Expected score range
  expectedScoreMin: number;
  expectedScoreMax: number;
}

export const CALIBRATION_CASES: CalibrationCase[] = [
  // ─── STRONG opportunities (proven successful businesses) ───────────

  {
    id: 'cal-01',
    topic: 'Missed call recovery for home services',
    expectedOpportunity: 'missed call recovery',
    expectedKeywords: ['missed', 'call', 'recovery'],
    verdict: 'strong',
    reasoning: 'Multiple companies (ServiceTitan, Housecall Pro) have built successful features around this. High pain, high willingness to pay.',
    expectedScoreMin: 7.0,
    expectedScoreMax: 10.0,
  },
  {
    id: 'cal-02',
    topic: 'Restaurant reservation management',
    expectedOpportunity: 'restaurant reservation',
    expectedKeywords: ['restaurant', 'reservation'],
    verdict: 'strong',
    reasoning: 'OpenTable, Resy, Yelp Reservations — billion-dollar market with clear demand.',
    expectedScoreMin: 7.0,
    expectedScoreMax: 10.0,
  },
  {
    id: 'cal-03',
    topic: 'Invoice automation for freelancers',
    expectedOpportunity: 'invoice automation',
    expectedKeywords: ['invoice', 'freelance'],
    verdict: 'strong',
    reasoning: 'FreshBooks, Wave, HoneyBook — massive proven market, ongoing pain.',
    expectedScoreMin: 7.0,
    expectedScoreMax: 10.0,
  },
  {
    id: 'cal-04',
    topic: 'Appointment scheduling for dental clinics',
    expectedOpportunity: 'dental scheduling',
    expectedKeywords: ['dental', 'scheduling', 'appointment'],
    verdict: 'strong',
    reasoning: 'Dentrix, Open Dental, NexHealth all serve this. Clear workflow anchor.',
    expectedScoreMin: 6.5,
    expectedScoreMax: 10.0,
  },
  {
    id: 'cal-05',
    topic: 'Property management for landlords',
    expectedOpportunity: 'property management',
    expectedKeywords: ['property', 'landlord', 'tenant', 'rental'],
    verdict: 'strong',
    reasoning: 'Buildium, AppFolio, TurboTenant — large proven market.',
    expectedScoreMin: 6.5,
    expectedScoreMax: 10.0,
  },

  // ─── MODERATE opportunities (viable but competitive/niche) ─────────

  {
    id: 'cal-06',
    topic: 'Pet grooming appointment scheduling',
    expectedOpportunity: 'pet grooming scheduling',
    expectedKeywords: ['pet', 'grooming', 'scheduling'],
    verdict: 'moderate',
    reasoning: 'Niche market, some solutions exist (Gingr, PetExec) but smaller TAM.',
    expectedScoreMin: 5.0,
    expectedScoreMax: 7.0,
  },
  {
    id: 'cal-07',
    topic: 'Construction crew scheduling',
    expectedOpportunity: 'construction crew scheduling',
    expectedKeywords: ['construction', 'crew', 'scheduling'],
    verdict: 'moderate',
    reasoning: 'Procore, Buildertrend dominate. Room for niche tools but stiff competition.',
    expectedScoreMin: 5.0,
    expectedScoreMax: 7.0,
  },
  {
    id: 'cal-08',
    topic: 'Fitness class booking systems',
    expectedOpportunity: 'fitness class booking',
    expectedKeywords: ['fitness', 'class', 'booking'],
    verdict: 'moderate',
    reasoning: 'Mindbody, Vagaro exist. Market saturated but ongoing complaints about UX.',
    expectedScoreMin: 5.0,
    expectedScoreMax: 7.0,
  },
  {
    id: 'cal-09',
    topic: 'Online course creation platforms',
    expectedOpportunity: 'online course creation',
    expectedKeywords: ['course', 'creation', 'online'],
    verdict: 'moderate',
    reasoning: 'Teachable, Thinkific, Kajabi — very crowded but large market.',
    expectedScoreMin: 4.5,
    expectedScoreMax: 7.0,
  },
  {
    id: 'cal-10',
    topic: 'Lawn care business management',
    expectedOpportunity: 'lawn care management',
    expectedKeywords: ['lawn', 'care'],
    verdict: 'moderate',
    reasoning: 'Jobber, LawnPro exist. Small but real niche with paying customers.',
    expectedScoreMin: 5.0,
    expectedScoreMax: 7.0,
  },

  // ─── WEAK opportunities (poor market fit or oversaturated) ─────────

  {
    id: 'cal-11',
    topic: 'Social media posting scheduler',
    expectedOpportunity: 'social media scheduler',
    expectedKeywords: ['social', 'media', 'scheduler'],
    verdict: 'weak',
    reasoning: 'Buffer, Hootsuite, Later, Sprout Social — extremely saturated, race to bottom.',
    expectedScoreMin: 2.0,
    expectedScoreMax: 5.0,
  },
  {
    id: 'cal-12',
    topic: 'Todo list app',
    expectedOpportunity: 'todo list',
    expectedKeywords: ['todo', 'task', 'list'],
    verdict: 'weak',
    reasoning: 'Todoist, TickTick, Things, Notion, hundreds of others. No differentiation possible.',
    expectedScoreMin: 2.0,
    expectedScoreMax: 5.0,
  },
  {
    id: 'cal-13',
    topic: 'Generic CRM for small business',
    expectedOpportunity: 'crm small business',
    expectedKeywords: ['crm'],
    verdict: 'weak',
    reasoning: 'Salesforce, HubSpot, Pipedrive, Zoho — hyper-competitive, no gaps left.',
    expectedScoreMin: 2.0,
    expectedScoreMax: 5.0,
  },
  {
    id: 'cal-14',
    topic: 'Website builder',
    expectedOpportunity: 'website builder',
    expectedKeywords: ['website', 'builder'],
    verdict: 'weak',
    reasoning: 'Wix, Squarespace, WordPress, Webflow — no room for new entrants.',
    expectedScoreMin: 2.0,
    expectedScoreMax: 4.5,
  },
  {
    id: 'cal-15',
    topic: 'Email marketing platform',
    expectedOpportunity: 'email marketing',
    expectedKeywords: ['email', 'marketing'],
    verdict: 'weak',
    reasoning: 'Mailchimp, ConvertKit, Klaviyo, ActiveCampaign — completely saturated.',
    expectedScoreMin: 2.0,
    expectedScoreMax: 5.0,
  },

  // ─── EDGE CASES ────────────────────────────────────────────────────

  {
    id: 'cal-16',
    topic: 'AI-powered contract review for small law firms',
    expectedOpportunity: 'contract review',
    expectedKeywords: ['contract', 'review', 'legal'],
    verdict: 'strong',
    reasoning: 'Emerging market, AI advantage clear, high willingness to pay in legal.',
    expectedScoreMin: 6.5,
    expectedScoreMax: 10.0,
  },
  {
    id: 'cal-17',
    topic: 'Plumber dispatch and routing software',
    expectedOpportunity: 'plumber dispatch routing',
    expectedKeywords: ['plumber', 'dispatch', 'routing'],
    verdict: 'strong',
    reasoning: 'ServiceTitan started here. Clear pain, high retention, good unit economics.',
    expectedScoreMin: 6.5,
    expectedScoreMax: 10.0,
  },
  {
    id: 'cal-18',
    topic: 'NFT marketplace',
    expectedOpportunity: 'nft marketplace',
    expectedKeywords: ['nft', 'marketplace'],
    verdict: 'weak',
    reasoning: 'Market crashed, OpenSea dominates what remains. Terrible timing.',
    expectedScoreMin: 2.0,
    expectedScoreMax: 4.0,
  },
  {
    id: 'cal-19',
    topic: 'Crypto tax calculation tool',
    expectedOpportunity: 'crypto tax',
    expectedKeywords: ['crypto', 'tax'],
    verdict: 'moderate',
    reasoning: 'CoinTracker, TaxBit exist but regulatory complexity creates ongoing need.',
    expectedScoreMin: 4.5,
    expectedScoreMax: 7.0,
  },
  {
    id: 'cal-20',
    topic: 'Veterinary telemedicine platform',
    expectedOpportunity: 'veterinary telemedicine',
    expectedKeywords: ['veterinary', 'telemedicine', 'vet'],
    verdict: 'moderate',
    reasoning: 'Post-COVID demand real but adoption slower than expected. Regulatory barriers.',
    expectedScoreMin: 4.5,
    expectedScoreMax: 7.0,
  },
];
