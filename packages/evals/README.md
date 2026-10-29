# @codetrail/evals

## What it is

The eval runner: has an agent build a tour of a fixture and scores it against what the fixture
expects.

## What it does, and does not

Does: build a fixture's repos from `evals/fixtures/<name>/` into a temporary folder, start the
agent in `CODETRAIL_AGENT` there as a background build does, wait for it, and report the route
reached and its order, how each expected link was cited, how strongly steps flag each bug line, how many steps carry flags, the time
taken, and the agent's last line of output: its numbers, when it is JSON.

Run it with `bun packages/evals/src/main.ts <fixture>`, or `… <fixture> <repo> <trail args>` to start in one repo, such as `refund web main...feature`, leaving the others for the agent to find. Each run spends the agent's tokens; it
is not part of `bun run check`.

Does not: judge narration, or count tokens itself.

## Where it fits

Depends on `@codetrail/core`. The agent reaches the fixture through `trail mcp`, as configured
for it.

## Why a package of its own

Evals depend on core but nothing depends on them, and they never ship in the `trail` binary.
