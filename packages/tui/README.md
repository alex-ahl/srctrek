# @codetrail/tui

## What it is

The terminal controller for a tour, built with OpenTUI and React.

## What it does, and does not

Does: show a home screen of tours and PRs awaiting review, a live view while a tour is
built, and a route map of the whole trail; and step through a tour with a code panel for
editors without a plugin. Today: lists the tours in the .codetrail/tours folder and opens the chosen
one in Neovim, and lists repos the agent proposed, for the user to add to the repos list or
dismiss.

Does not: talk to git or the model, or define the tour format. That is all in core.

## Where it fits

Depends on `@codetrail/core`. Exports `startHome`, which the cli (`packages/cli/`) calls.
The render smoke check used by CI: `packages/tui/src/smoke.tsx`.

## Why a package of its own

OpenTUI is pre-1.0 and ships native code; keeping it in one thin package bounds what an
upgrade or a swap to another TUI library can touch.
