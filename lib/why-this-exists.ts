import { OpportunityCandidate } from './types';

export function generateWhyThisExists(c: OpportunityCandidate): string[] {
  const bullets: string[] = [];
  const b = c.scores.breakdown;
  const compResult = c.detectorResults.find(r => r.detectorId === 'competitionWeakness');
  const distResult = c.detectorResults.find(r => r.detectorId === 'distributionAccess');
  const timingResult = c.detectorResults.find(r => r.detectorId === 'marketTiming');
  const aiResult = c.detectorResults.find(r => r.detectorId === 'aiAdvantage');

  // 1. Core pain
  const painScore = b['painIntensity'] ?? 0;
  const painEvidence = c.evidence.filter(e => e.signalType === 'pain');
  if (painScore >= 6) {
    const topPain = painEvidence[0]?.excerpt.slice(0, 80) ?? 'significant workflow friction';
    bullets.push(
      `${c.targetBuyer}s are losing revenue or wasting hours: "${topPain}..."`
    );
  } else if (painScore >= 3) {
    bullets.push(
      `${c.targetBuyer}s in ${c.vertical} face recurring friction with ${c.jobToBeDone} -- enough to seek alternatives.`
    );
  } else {
    bullets.push(
      `Mild pain around ${c.jobToBeDone}, but ${c.targetBuyer}s may not urgently need a solution yet.`
    );
  }

  // 2. Buyer + budget
  const payScore = b['abilityToPay'] ?? 0;
  if (payScore >= 7) {
    const moneyEvidence = c.evidence.find(e => e.signalType === 'money');
    const priceHint = moneyEvidence?.excerpt.match(/\$\d+/)?.[0];
    bullets.push(
      `The buyer has budget${priceHint ? ` (signals suggest ${priceHint}+/mo spend)` : ''} and is already paying for inferior solutions.`
    );
  } else if (payScore >= 4) {
    bullets.push(
      `${c.targetBuyer}s have moderate budget, but willingness to pay needs validation.`
    );
  }

  // 3. Timing
  const timingScore = b['marketTiming'] ?? 0;
  if (timingResult && timingScore >= 6) {
    const phase = timingResult.explanation.match(/Market phase: (\w+)/)?.[1] ?? 'growth';
    if (phase === 'optimal') {
      bullets.push(
        `Market timing is optimal: demand is accelerating and incumbents haven't consolidated yet.`
      );
    } else if (phase === 'early') {
      bullets.push(
        `Early market: few solutions exist, creating a first-mover window before competitors enter.`
      );
    }
  } else if (timingScore >= 3) {
    bullets.push(
      `Market is active but not exploding -- timing is acceptable if you move quickly.`
    );
  }

  // 4. Competition weakness
  const compScore = b['competitionWeakness'] ?? 0;
  if (compResult && compScore >= 7) {
    bullets.push(
      `Incumbents are weak: ${compResult.explanation.toLowerCase().includes('pricing') ? 'recent price hikes + customer backlash' : 'poor reviews and clunky UX'} create a clear opening.`
    );
  } else if (compScore >= 4) {
    bullets.push(
      `Some competitor weaknesses exist, but differentiation will require a focused wedge.`
    );
  }

  // 5. Distribution
  const distScore = b['distributionAccess'] ?? 0;
  if (distResult && distScore >= 5) {
    const channels = distResult.explanation.match(/channels: ([^.]+)/)?.[1] ?? 'identifiable channels';
    bullets.push(
      `Distribution is plausible via ${channels} -- ${c.targetBuyer}s are findable and reachable.`
    );
  }

  // Bonus: AI advantage if notable
  if (aiResult && (b['aiAdvantage'] ?? 0) >= 6) {
    bullets.push(
      `AI meaningfully improves the solution (${aiResult.explanation.split('.')[0].toLowerCase()}) -- not just a feature label.`
    );
  }

  // Ensure 3-5 bullets
  return bullets.slice(0, 5);
}
