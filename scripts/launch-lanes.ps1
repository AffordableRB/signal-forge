# Launch all 4 engineering lanes in parallel Claude Code sessions.
# Each session reads its lane instructions and works autonomously.
#
# Usage:
#   .\scripts\launch-lanes.ps1          # launch all 4 lanes
#   .\scripts\launch-lanes.ps1 1 3      # launch only lanes 1 and 3

param(
    [int[]]$Lanes = @(1, 2, 3, 4)
)

$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$Prompts = @{
    1 = "Read the file lanes/orchestrator/CLAUDE.md. You are Lane 1: Orchestrator Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all 5 tasks. Do not ask questions - make decisions and keep moving."
    2 = "Read the file lanes/signal-quality/CLAUDE.md. You are Lane 2: Signal Quality Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all 5 tasks. Do not ask questions - make decisions and keep moving."
    3 = "Read the file lanes/analysis/CLAUDE.md. You are Lane 3: Analysis Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all 5 tasks. Do not ask questions - make decisions and keep moving."
    4 = "Read the file lanes/benchmarks/CLAUDE.md. You are Lane 4: Benchmark Engineer. Execute every task in your task queue, in priority order. For each task: implement it, then validate with npm run build && npm run orch:benchmark:e2e && npm run orch:benchmark:check. If validation passes, commit. If it fails, fix and retry. Work through all remaining tasks. Do not ask questions - make decisions and keep moving."
}

$Names = @{
    1 = "orchestrator"
    2 = "signal-quality"
    3 = "analysis"
    4 = "benchmarks"
}

foreach ($lane in $Lanes) {
    if (-not $Prompts.ContainsKey($lane)) {
        Write-Host "Unknown lane: $lane (use 1-4)"
        continue
    }

    $name = $Names[$lane]
    $prompt = $Prompts[$lane]

    Write-Host "Launching Lane $lane ($name)..."

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$ProjectDir\web'; Write-Host 'Lane $lane - $name' -ForegroundColor Cyan; claude --dangerously-skip-permissions '$prompt'"
    )
}

Write-Host ""
Write-Host "All lanes launched. You can walk away now."
Write-Host "Each lane validates against benchmarks before committing."
Write-Host "Check git log when you return to see what was built."
