import { Detector } from './base';
import { OpportunityCandidate } from '../models/types';
import { DemandDetector } from './demand';
import { PainIntensityDetector } from './pain-intensity';
import { AbilityToPayDetector } from './ability-to-pay';
import { CompetitionWeaknessDetector } from './competition-weakness';
import { EaseToBuildDetector } from './ease-to-build';
import { DistributionAccessDetector } from './distribution-access';
import { WorkflowAnchorDetector } from './workflow-anchor';
import { MarketExpansionDetector } from './market-expansion';
import { MarketTimingDetector } from './market-timing';
import { RevenueDensityDetector } from './revenue-density';
import { SwitchingFrictionDetector } from './switching-friction';
import { AIAdvantageDetector } from './ai-advantage';
import { UnitEconomicsDetector } from './unit-economics';
import { FounderFitDetector } from './founder-fit';
import { DefensibilityDetector } from './defensibility';

export function createDetectors(): Detector[] {
  return [
    new DemandDetector(),
    new PainIntensityDetector(),
    new AbilityToPayDetector(),
    new CompetitionWeaknessDetector(),
    new EaseToBuildDetector(),
    new DistributionAccessDetector(),
    new WorkflowAnchorDetector(),
    new MarketExpansionDetector(),
    new MarketTimingDetector(),
    new RevenueDensityDetector(),
    new SwitchingFrictionDetector(),
    new AIAdvantageDetector(),
    new UnitEconomicsDetector(),
    new FounderFitDetector(),
    new DefensibilityDetector(),
  ];
}

export function analyzeCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
  const detectors = createDetectors();
  const results = detectors.map(d => d.analyze(candidate));
  return {
    ...candidate,
    detectorResults: results,
  };
}

export function analyzeAll(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return candidates.map(c => analyzeCandidate(c));
}
