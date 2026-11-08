# @srctrek/core

## What it is

The engine of srctrek: everything behind building, validating, and showing a trek, with
no UI code.

## What it does, and does not

Does: resolve repos, ranges, and base branches; fetch remote refs; read and search files at
a revision; hold the prompts (`packages/core/prompts/`) and the trek schema
(`packages/core/src/schema/`); validate submitted treks; save and load treks.

Does not: render anything, read keys, open editors, speak MCP, or call a model.

## Where it fits

The TUI (`packages/tui/`), and later the MCP server and a web GUI, import from
`packages/core/src/index.ts` and nothing else in this package.

## Why a package of its own

So a second front-end can be added without touching trek building, and so the no-UI
boundary is enforced by imports rather than convention.
