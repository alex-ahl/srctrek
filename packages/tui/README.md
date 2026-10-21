# @codetrail/tui

## What it is

The terminal controller for a tour, built with OpenTUI and React, and for now the `trail`
binary's entry point.

## What it does, and does not

Does: show the overview and the current step, handle stepping keys, show the call stack,
collapse context and trivial steps, move the editor to each step, and show the code itself
when the editor can't follow.

Does not: talk to git or the model, or define the tour format. That is all in core.

## Where it fits

Depends on `@codetrail/core`. Entry point: `packages/tui/src/main.tsx`. The render smoke
check used by CI: `packages/tui/src/smoke.tsx`.

## Why a package of its own

OpenTUI is pre-1.0 and ships native code; keeping it in one thin package bounds what an
upgrade or a swap to another TUI library can touch.
