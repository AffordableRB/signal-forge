# Collector Fix Tasks — 4 Terminal Parallel Plan

Run `npm run orch:collector:bench` to validate. Each terminal owns one collector file.
Do NOT modify files outside your assigned collector unless noted.

---

## Terminal 1: Reviews Collector (`lib/engine/collectors/reviews.ts`)

### Problem
G2, Capterra, and Trustpilot HTML parsers use hardcoded CSS class selectors that no longer match the current DOM structure of these sites. ScraperAPI returns HTML, but the regex extraction finds nothing.

### Task
1. Run `npm run orch:collector:bench -- reviews` to confirm the failure
2. Use ScraperAPI to fetch a real page from each site and inspect the actual HTML:
   - `https://www.g2.com/search?query=CRM+software`
   - `https://www.capterra.com/search/?query=CRM+software`
   - `https://www.trustpilot.com/search?query=CRM+software`
3. Update the regex patterns in `scrapeG2()`, `scrapeCapterra()`, `scrapeTrustpilot()` to match the current HTML structure
4. Consider adding a generic fallback extractor that grabs any substantial text blocks (50-500 chars) near review-related keywords if the specific patterns fail
5. Run `npm run orch:collector:bench -- reviews` — both `reviews-crm` and `reviews-fitness` cases must pass

### Benchmark Targets
- `reviews-crm`: >= 1 signal, >= 3 evidence pieces, < 40s
- `reviews-fitness`: >= 1 signal, >= 2 evidence pieces, < 40s

### Files to Modify
- `lib/engine/collectors/reviews.ts` (primary)

### Validation
```bash
npm run orch:collector:bench -- reviews
npm run build
npm run orch:benchmark
```

---

## Terminal 2: Pricing Collector (`lib/engine/collectors/pricing.ts`)

### Problem
Google search snippet extraction uses CSS class names (`VwiC3b`, `IsZvec`, `BNeawe`, `st`, `snippet`) that Google changes frequently. The collector fetches HTML via ScraperAPI but extracts nothing useful.

### Task
1. Run `npm run orch:collector:bench -- pricing` to confirm the failure
2. Use ScraperAPI to fetch a real Google search page and inspect the actual HTML:
   - `https://www.google.com/search?q=CRM+software+pricing`
3. Update `extractSnippets()` to match current Google search result HTML structure
4. Consider a more resilient approach: instead of specific CSS classes, look for text blocks between HTML tags that are 50-400 chars and contain pricing-related keywords
5. Also uncomment/re-enable `scrapePricingComplaints()` — it's currently skipped but would add valuable "too expensive" signals
6. Run `npm run orch:collector:bench -- pricing` — both cases must pass

### Benchmark Targets
- `pricing-crm`: >= 1 signal, >= 1 evidence piece, < 40s
- `pricing-fitness`: >= 1 signal, >= 1 evidence piece, < 40s

### Files to Modify
- `lib/engine/collectors/pricing.ts` (primary)

### Validation
```bash
npm run orch:collector:bench -- pricing
npm run build
npm run orch:benchmark
```

---

## Terminal 3: Jobs Collector (`lib/engine/collectors/upwork.ts`)

### Problem
Indeed HTML parsing uses outdated CSS class selectors (`resultContent`, `job_seen_beacon`, `jobTitle`, `job-snippet`). Indeed frequently changes its DOM. The collector fetches the page but extracts zero job cards.

### Task
1. Run `npm run orch:collector:bench -- jobs` to confirm the failure
2. Use ScraperAPI to fetch a real Indeed page and inspect the HTML:
   - `https://www.indeed.com/jobs?q=software+developer&sort=date`
3. Update `extractMatches()` patterns to match current Indeed HTML structure
4. Consider switching to Indeed's mobile site (`https://m.indeed.com/...`) which tends to have simpler, more stable HTML
5. Add a fallback: if no job cards are found via patterns, try extracting `<a>` tags with "job" in their href or text
6. Run `npm run orch:collector:bench -- jobs` — both cases must pass

### Benchmark Targets
- `jobs-plumbing`: >= 1 signal, >= 1 evidence piece, < 40s
- `jobs-fitness`: >= 1 signal, >= 1 evidence piece, < 40s

### Files to Modify
- `lib/engine/collectors/upwork.ts` (primary)

### Validation
```bash
npm run orch:collector:bench -- jobs
npm run build
npm run orch:benchmark
```

---

## Terminal 4: Integration & HN/PH Polish

### Problem
HN and Product Hunt collectors work mechanically but produce low/zero results for non-tech topics. The new `collector-benchmark.ts` needs validation. The overall collector pipeline needs a smoke test for diverse topics.

### Task
1. Run `npm run orch:collector:bench` (all cases) to establish the baseline
2. Verify the HN query simplification (already implemented) actually improves results:
   - `npm run orch:collector:bench -- hn`
   - If `hn-fitness` still fails, tune `simplifyQueries()` in `hacker-news.ts`
3. Verify Product Hunt RSS matching works:
   - `npm run orch:collector:bench -- ph`
   - If PH fails, the RSS feed may not have relevant items — that's acceptable
4. Add 2-3 more benchmark cases for underrepresented topics to `collector-benchmark.ts`:
   - A "restaurant" topic (should test Reddit dynamic subs)
   - A "construction" topic (should work with default subs)
   - A "legal" topic (another vertical test)
5. Run full validation suite and fix any regressions:
   ```bash
   npm run build
   npm run orch:benchmark
   npm run orch:benchmark:e2e
   npm run orch:collector:bench
   ```

### Files to Modify
- `benchmarks/collector-benchmark.ts` (add cases)
- `lib/engine/collectors/hacker-news.ts` (tune if needed)
- `lib/engine/collectors/product-hunt.ts` (tune if needed)

### Validation
```bash
npm run orch:collector:bench
npm run build
npm run orch:benchmark
npm run orch:benchmark:e2e
```

---

## Coordination Rules

1. Each terminal modifies ONLY its assigned files
2. All terminals share `benchmarks/collector-benchmark.ts` as read-only (Terminal 4 owns writes)
3. Before committing, every terminal must pass:
   - `npm run build`
   - `npm run orch:benchmark` (12 calibration cases)
4. Terminal 4 runs last and does the full integration sweep
5. If a proxy-dependent test shows `SKIP`, that means `SCRAPER_API_KEY` is not set — test locally with the key in `.env.local`

## Quick Start

```bash
# Create .env.local with your keys (if not on Vercel)
echo "SCRAPER_API_KEY=your_key_here" >> web/.env.local
echo "ANTHROPIC_API_KEY=your_key_here" >> web/.env.local

# Run all collector benchmarks
npm run orch:collector:bench

# Run just one collector's benchmarks
npm run orch:collector:bench -- reviews
npm run orch:collector:bench -- pricing
npm run orch:collector:bench -- jobs
npm run orch:collector:bench -- hn
```
