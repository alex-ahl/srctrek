#!/usr/bin/env bash
# The evals, with trek built from this tree: each fixture named, or every one, run once against
# evals/baseline.json; with --baseline first, the baseline taken again. The agent is trek's own.
set -euo pipefail
cd "$(dirname "$0")/.."

bun run build >/dev/null
export PATH="$PWD/dist:$PATH"

# a sleeping machine stretches a run's time, which the baseline compares
awake=()
if command -v caffeinate >/dev/null; then
  awake=(caffeinate -i)
fi

if [ "${1:-}" = "--baseline" ]; then
  exec ${awake[@]+"${awake[@]}"} bun packages/evals/src/main.ts "$@"
fi

fixtures=("$@")
if [ ${#fixtures[@]} -eq 0 ]; then
  fixtures=($(ls evals/fixtures))
fi

for fixture in "${fixtures[@]}"; do
  ${awake[@]+"${awake[@]}"} bun packages/evals/src/main.ts "$fixture"
done
