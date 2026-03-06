# Benchmark Classification Gaps

Known cases where the market classifier produces arguably incorrect ocean types.
These are tracked here for Lane 3 (Analysis Engine) to address.

## Cases That Should Be Red But Classify Purple

### Case 11: Print shop management (currently: purple, expected: red)
- **Why it should be red:** Print is a declining market. Evidence explicitly says "dying", "declining", "obsolete", "replaced by digital". Market shrinking means building here has negative tailwinds.
- **Why it classifies purple:** The 3 competitors have exploitable weaknesses ("legacy", "outdated", "limited features"), which triggers Rule P2 in the classifier. The `assessMaturity` function correctly identifies it as "declining", but the classifier doesn't use maturity as a disqualifying signal for purple.
- **Suggested fix:** Add a red-ocean rule for declining markets: if `maturityLevel === 'declining'`, classify as red regardless of wedges. A shrinking market with exploitable competitor weaknesses is still a bad market.
- **Current workaround:** Benchmark expects `maxScore: 4.5, ocean: 'purple'` — the low score already flags it as weak.

### Case 8: Social media scheduler for creators (currently: purple, expected: red)
- **Why it should be red:** 4+ direct competitors (Buffer, Hootsuite, Later, Sprout Social) plus the evidence mentions crowded market. Low ability-to-pay (individual creators, $0-15/mo). High feature overlap.
- **Why it classifies purple:** With only 4 named competitors, the count stays below the >10 threshold in Rule R1. And the innovation gap may be high enough to trigger purple rules.
- **Suggested fix:** Factor in low `abilityToPay` scores and high `demand` + low `revenueDensity` as a red signal. Also consider lowering the R1 competitor threshold or using adjacent competitor density more aggressively.
- **Current workaround:** Benchmark expects `maxScore: 5, ocean: 'purple'` — score cap constrains the rating.

## Action Items

1. Lane 3 should add a declining-market red-ocean rule
2. Lane 3 should consider ability-to-pay in classification (high demand + low pay = risky)
3. After Lane 3 makes changes, Lane 4 updates benchmark expectations and baseline
