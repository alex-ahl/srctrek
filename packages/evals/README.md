# @srctrek/evals

## What it is

The eval runner: has an agent build a trek of a fixture and scores it against what the fixture
expects.

## What it does, and does not

Does: build a fixture's repos from `evals/fixtures/<name>/` into a temporary folder, start the
agent in `SRCTREK_AGENT` there as a background build does, wait for it, and report the route
reached and its order, how each expected link was cited, how strongly steps flag each bug line, how many steps carry flags, any decoy repos the trek stepped into, the time
taken, and the agent's last line of output: its numbers, when it is JSON.

Run it with `bun packages/evals/src/main.ts <fixture>`, or `… <fixture> <repo> <trek args>` to start in one repo, such as `refund web main...feature`, leaving the others for the agent to find. `--reviewer` builds the repos as clones of stand-in hosts, the work only on `origin/feature`, as a reviewer has it: `refund --reviewer web origin/main...origin/feature`. `--update` then commits the fixture's follow-ups (`<repo>/followup.patch`) and has the agent update the trek, reporting both runs: `refund --update`. Each run spends the agent's tokens; it
is not part of `bun run check`.

Does not: judge narration, or count tokens itself.

## Where it fits

Depends on `@srctrek/core`. The agent reaches the fixture through `trek mcp`, as configured
for it.

## Why a package of its own

Evals depend on core but nothing depends on them, and they never ship in the `trek` binary.
