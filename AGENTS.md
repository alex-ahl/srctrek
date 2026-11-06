# codetrail — agent entry point

codetrail turns a change — git ranges or pull requests, across repos — into a debugger-style
walkthrough (a "trail") that drives the user's editor from trigger to outcome.
Command: `trail`. Product: `docs/PRODUCT.md`. Architecture: `docs/ARCHITECTURE.md`.
Design: `docs/DESIGN.md`. Current state: `docs/HANDOFF.md`. Decisions: `DECISIONS.md`.

## Phase

**Pre-release, strict version 1.** No backward compatibility, no deprecated aliases, no
migration layers. When something changes, change it everywhere at once.

## Rules that never relax

- **`core` never imports UI code.** Front-ends only use what `packages/core/src/index.ts` exports.
- **Never assume a specific editor, agent, or editor plugin.** codetrail ships no integrations
  with other plugins (which-key, file explorers); it exposes commands, functions, and events
  for the user to wire up.
- **Predicted values are always labeled as predicted.** Never present them as real data.
- **Every link between steps cites its evidence;** a link matched only by name is marked guessed.
- **Prompts live in `packages/core/prompts/`,** never inline in code.
- **Typecheck, lint, tests, and the docs check pass on every commit** (`bun run check`).
- **Stage only the files you changed;** never `git add -A`.

## Commands

| Command               | Does                                                    |
| --------------------- | ------------------------------------------------------- |
| `bun install`         | Install dependencies (Bun >= 1.3.14)                    |
| `bun run check`       | Typecheck, lint, format check, tests, docs check        |
| `bun run format`      | Format everything with Prettier                         |
| `bun run build`       | Compile the `trail` binary into dist                    |
| `bun run build:smoke` | Compile the render smoke binary into dist               |
| `bun run check:docs`  | Verify paths and links in current docs, package READMEs |

## Layout

- `packages/core/` — git, schema, prompts, validation, saving and loading tours. No UI.
- `packages/cli/` — the `trail` entry point: arguments, resolving the change, starting a
  front-end.
- `packages/mcp/` — the MCP server, `trail mcp`, for the agent that builds a tour.
- `packages/serve/` — the editor protocol's server, `trail serve`, for editors stepping a tour.
- `packages/tui/` — OpenTUI + React front-end.
- `packages/evals/` — the eval runner: an agent builds a fixture's tour, scored against
  expected.json.
- `editors/nvim/` — the Neovim plugin (Lua).
- `editors/vscode/` — the VS Code extension, for VS Code and its forks.
- `evals/fixtures/` — sample repos for tour-quality evals.
- `scripts/` — repo tooling.
