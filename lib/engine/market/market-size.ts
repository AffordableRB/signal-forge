import { OpportunityCandidate, MarketSize } from '../models/types';

// US business counts by vertical (approximate)
const VERTICAL_BUSINESS_COUNT: Record<string, number> = {
  'home-services': 900_000,
  'healthcare': 400_000,
  'legal': 450_000,
  'real-estate': 350_000,
  'ecommerce': 2_000_000,
  'saas': 50_000,
  'finance': 300_000,
  'education': 250_000,
  'recruitment': 100_000,
  'general': 500_000,
};

// Addressable % of those businesses (SMB focus)
const ADDRESSABLE_RATE: Record<string, number> = {
  'home-services': 0.5,
  'healthcare': 0.3,
  'legal': 0.4,
  'real-estate': 0.4,
  'ecommerce': 0.2,
  'saas': 0.6,
  'finance': 0.3,
  'education': 0.3,
  'recruitment': 0.5,
  'general': 0.3,
};

// Average SaaS price by vertical
const AVG_MONTHLY_PRICE: Record<string, number> = {
  'home-services': 79,
  'healthcare': 149,
  'legal': 129,
  'real-estate': 99,
  'ecommerce': 49,
  'saas': 199,
  'finance': 149,
  'education': 39,
  'recruitment': 129,
  'general': 79,
};

export function estimateMarketSize(candidate: OpportunityCandidate): MarketSize {
  const vertical = candidate.vertical;
  const totalBusinesses = VERTICAL_BUSINESS_COUNT[vertical] ?? 500_000;
  const addressableRate = ADDRESSABLE_RATE[vertical] ?? 0.3;
  const avgPrice = AVG_MONTHLY_PRICE[vertical] ?? 79;

  const potentialBuyers = Math.round(totalBusinesses * addressableRate);

  // Adoption rate based on demand + pain scores
  const demandScore = candidate.detectorResults.find(r => r.detectorId === 'demand')?.score ?? 3;
  const painScore = candidate.detectorResults.find(r => r.detectorId === 'painIntensity')?.score ?? 3;
  const easeScore = candidate.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 5;

  // Base adoption: 2-15% depending on scores
  const adoptionBase = 0.02 + ((demandScore + painScore) / 20) * 0.13;
  // Adjust for ease of adoption
  const adoptionRate = Math.round(adoptionBase * (0.5 + easeScore / 20) * 1000) / 1000;

  const potentialCustomers = Math.round(potentialBuyers * adoptionRate);
  const revenueCeiling = potentialCustomers * avgPrice * 12;

  // Build explanation
  const parts: string[] = [];
  parts.push(`~${(potentialBuyers / 1000).toFixed(0)}K addressable ${candidate.targetBuyer}s in ${vertical}`);
  parts.push(`${(adoptionRate * 100).toFixed(1)}% adoption assumption`);
  parts.push(`${potentialCustomers.toLocaleString()} potential customers at $${avgPrice}/mo`);

  return {
    potentialBuyers,
    adoptionRate,
    potentialCustomers,
    avgMonthlyPrice: avgPrice,
    revenueCeiling,
    explanation: parts.join('. ') + '.',
  };
}
