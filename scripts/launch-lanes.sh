#!/usr/bin/env bash
# Launch all 4 engineering lanes in parallel Claude Code sessions.
# Each session reads its lane instructions and works autonomously.
#
# Usage:
#   bash scripts/launch-lanes.sh          # launch all 4 lanes
#   bash scripts/launch-lanes.sh 1 3      # launch only lanes 1 and 3

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

LANE1_PROMPT="Read the file lanes/orchestrator/CLAUDE.md. You are Lane 1: Orchestrator Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all 5 tasks. Do not ask questions — make decisions and keep moving."

LANE2_PROMPT="Read the file lanes/signal-quality/CLAUDE.md. You are Lane 2: Signal Quality Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all 5 tasks. Do not ask questions — make decisions and keep moving."

LANE3_PROMPT="Read the file lanes/analysis/CLAUDE.md. You are Lane 3: Analysis Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all 5 tasks. Do not ask questions — make decisions and keep moving."

LANE4_PROMPT="Read the file lanes/benchmarks/CLAUDE.md. You are Lane 4: Benchmark Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all remaining tasks. Do not ask questions — make decisions and keep moving."

# Default: launch all lanes
LANES="${@:-1 2 3 4}"

for lane in $LANES; do
  case $lane in
    1) PROMPT="$LANE1_PROMPT"; NAME="orchestrator" ;;
    2) PROMPT="$LANE2_PROMPT"; NAME="signal-quality" ;;
    3) PROMPT="$LANE3_PROMPT"; NAME="analysis" ;;
    4) PROMPT="$LANE4_PROMPT"; NAME="benchmarks" ;;
    *) echo "Unknown lane: $lane (use 1-4)"; continue ;;
  esac

  echo "Launching Lane $lane ($NAME)..."
  start "Lane $lane - $NAME" bash -c "cd '$PROJECT_DIR' && claude --dangerously-skip-permissions '$PROMPT'; echo 'Lane $lane finished. Press enter to close.'; read"
done

echo ""
echo "All lanes launched. You can walk away now."
echo "Each lane validates against benchmarks before committing."
echo "Check git log when you return to see what was built."
