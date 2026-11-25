# @srctrek/tui

## What it is

The terminal controller for a trek, built with OpenTUI and React.

## What it does, and does not

Does: show a landing page of the changes to look at, each with its trek's state; a change's
screen, where its trek is built, with the repos the agent proposed, and its overview once saved;
the code as it is with its ways in; a route map of the whole trek; and step through a trek with a
code panel for editors without a plugin, or open it in Neovim. All in the terminal's own colours.

Does not: talk to git or the model, or define the trek format. That is all in core.

## Where it fits

Depends on `@srctrek/core`. Exports `startScreens`, which the cli (`packages/cli/`) calls.
The render smoke check used by CI: `packages/tui/src/smoke.tsx`. Every screen and state, drawn
as text and pictures in a dark and a light terminal's colours:
`bun packages/tui/test/capture-screens.tsx <out-dir> [screen]...`. The built `trek` in a real
terminal, after pressing keys, drawn the same way:
`bun packages/tui/test/capture-terminal.ts <out-prefix> [--cwd <dir>] [--size <W>x<H>] [--keys "<key>…"] [-- <trek args>…]`.

## Why a package of its own

OpenTUI is pre-1.0 and ships native code; keeping it in one thin package bounds what an
upgrade or a swap to another TUI library can touch.
