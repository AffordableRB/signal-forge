#!/usr/bin/env bash
# Launch 4 parallel Claude Code sessions to fix broken collectors.
# Each session owns one collector file and validates against collector benchmarks.
#
# Usage:
#   bash scripts/launch-collector-fixes.sh          # launch all 4
#   bash scripts/launch-collector-fixes.sh 1 3      # launch only terminals 1 and 3

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

T1_PROMPT="Fix the Reviews collector (lib/engine/collectors/reviews.ts). The HTML scrapers for G2, Capterra, and Trustpilot use outdated CSS class selectors that no longer match the current DOM. Steps: 1) Run npm run orch:collector:bench -- reviews to confirm failure. 2) Write a temp script to fetch real HTML from each site via ScraperAPI and inspect the actual structure (G2: https://www.g2.com/search?query=CRM+software, Capterra: https://www.capterra.com/search/?query=CRM+software, Trustpilot: https://www.trustpilot.com/search?query=CRM+software). 3) Update the regex patterns in scrapeG2(), scrapeCapterra(), scrapeTrustpilot() to match current HTML. 4) Add a generic fallback extractor that grabs substantial text blocks (50-500 chars) if specific patterns fail. 5) Run npm run orch:collector:bench -- reviews and both reviews-crm and reviews-fitness must pass. 6) Run npm run build and npm run orch:benchmark to confirm no regressions. ONLY modify lib/engine/collectors/reviews.ts. Read docs/collector-fix-tasks.md for full context. Do not ask questions — make decisions and keep moving."

T2_PROMPT="Fix the Pricing collector (lib/engine/collectors/pricing.ts). Google search snippet extraction uses CSS class names (VwiC3b, IsZvec, BNeawe) that Google changes frequently. extractSnippets() finds nothing. Steps: 1) Run npm run orch:collector:bench -- pricing to confirm failure. 2) Write a temp script to fetch real Google search HTML via ScraperAPI and inspect structure (https://www.google.com/search?q=CRM+software+pricing). 3) Update extractSnippets() to match current Google search HTML. 4) Use a resilient approach: look for text blocks 50-400 chars containing pricing keywords rather than specific CSS classes. 5) Re-enable scrapePricingComplaints() for extra too-expensive signals. 6) Run npm run orch:collector:bench -- pricing and both pricing-crm and pricing-fitness must pass. 7) Run npm run build and npm run orch:benchmark to confirm no regressions. ONLY modify lib/engine/collectors/pricing.ts. Read docs/collector-fix-tasks.md for full context. Do not ask questions — make decisions and keep moving."

T3_PROMPT="Fix the Jobs collector (lib/engine/collectors/upwork.ts). Indeed HTML parsing uses outdated CSS selectors (resultContent, job_seen_beacon, jobTitle, job-snippet). Steps: 1) Run npm run orch:collector:bench -- jobs to confirm failure. 2) Write a temp script to fetch real Indeed HTML via ScraperAPI and inspect structure (https://www.indeed.com/jobs?q=software+developer&sort=date). 3) Update extractMatches() patterns to match current Indeed HTML. 4) Consider Indeed mobile site (https://m.indeed.com/) for simpler HTML. 5) Add a fallback if no job cards found via patterns. 6) Run npm run orch:collector:bench -- jobs and both jobs-plumbing and jobs-fitness must pass. 7) Run npm run build and npm run orch:benchmark to confirm no regressions. ONLY modify lib/engine/collectors/upwork.ts. Read docs/collector-fix-tasks.md for full context. Do not ask questions — make decisions and keep moving."

T4_PROMPT="You own integration and polish for the collector benchmark suite. Other terminals are fixing reviews.ts, pricing.ts, and upwork.ts in parallel. Steps: 1) Run npm run orch:collector:bench to establish baseline. 2) Verify HN query simplification works: npm run orch:collector:bench -- hn. If hn-fitness fails, tune simplifyQueries() in lib/engine/collectors/hacker-news.ts. 3) Verify Product Hunt RSS: npm run orch:collector:bench -- ph. 4) Add 3 more benchmark cases to benchmarks/collector-benchmark.ts for restaurant, construction, and legal topics. 5) After other terminals finish, run full validation: npm run build && npm run orch:benchmark && npm run orch:benchmark:e2e && npm run orch:collector:bench. You may modify: benchmarks/collector-benchmark.ts, lib/engine/collectors/hacker-news.ts, lib/engine/collectors/product-hunt.ts. Read docs/collector-fix-tasks.md for full context. Do not ask questions — make decisions and keep moving."

# Default: launch all
TERMINALS="${@:-1 2 3 4}"

for t in $TERMINALS; do
  case $t in
    1) PROMPT="$T1_PROMPT"; NAME="reviews" ;;
    2) PROMPT="$T2_PROMPT"; NAME="pricing" ;;
    3) PROMPT="$T3_PROMPT"; NAME="jobs" ;;
    4) PROMPT="$T4_PROMPT"; NAME="integration" ;;
    *) echo "Unknown terminal: $t (use 1-4)"; continue ;;
  esac

  echo "Launching Terminal $t ($NAME)..."
  start "Collector Fix $t - $NAME" bash -c "cd '$PROJECT_DIR' && claude --dangerously-skip-permissions '$PROMPT'; echo 'Terminal $t ($NAME) finished. Press enter to close.'; read"
done

echo ""
echo "All terminals launched."
echo "Each terminal validates with: npm run orch:collector:bench"
echo "Terminal 4 does the final integration sweep."
