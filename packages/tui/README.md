# @srctrek/tui

## What it is

The terminal controller for a trek, built with OpenTUI and React.

## What it does, and does not

Does: show a home screen of treks and PRs awaiting review, a live view while a trek is
built, and a route map of the whole trek; and step through a trek with a code panel for
editors without a plugin. Today: lists the treks in the .srctrek/treks folder and opens the chosen
one in Neovim, and lists repos the agent proposed, for the user to add to the repos list or
dismiss.

Does not: talk to git or the model, or define the trek format. That is all in core.

## Where it fits

Depends on `@srctrek/core`. Exports `startHome`, which the cli (`packages/cli/`) calls.
The render smoke check used by CI: `packages/tui/src/smoke.tsx`. Every screen and state, drawn
as text and pictures in a dark and a light terminal's colours:
`bun packages/tui/test/capture-screens.tsx <out-dir> [screen]...`.

## Why a package of its own

OpenTUI is pre-1.0 and ships native code; keeping it in one thin package bounds what an
upgrade or a swap to another TUI library can touch.
