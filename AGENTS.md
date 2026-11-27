# srctrek — agent entry point

srctrek turns a change — git ranges or pull requests, across repos — into a debugger-style
walkthrough (a "trek") that drives the user's editor from trigger to outcome.
Command: `trek`. Product: `docs/PRODUCT.md`. Architecture: `docs/ARCHITECTURE.md`.
Design: `docs/DESIGN.md`. Current state: `docs/HANDOFF.md`. Decisions: `DECISIONS.md`.

## Phase

**Pre-release, strict version 1.** No backward compatibility, no deprecated aliases, no
migration layers. When something changes, change it everywhere at once.

## Rules that never relax

- **`core` never imports UI code.** Front-ends only use what `packages/core/src/index.ts` exports.
- **Never assume a specific editor, agent, or editor plugin.** srctrek ships no integrations
  with other plugins (which-key, file explorers); it exposes commands, functions, and events
  for the user to wire up.
- **Predicted values are always labeled as predicted.** Never present them as real data.
- **Every link between steps cites its evidence;** a link matched only by name is marked guessed.
- **Prompts live in `packages/core/prompts/`,** never inline in code.
- **A change to a prompt a trek is built from waits for the evals:** any in
  `packages/core/prompts/` within `PROMPT_HASH`. Before it's committed, every
  fixture is run once against `evals/baseline.json` (`scripts/evals.sh`); a ✗ is understood before
  the commit, and a change meant to move the results takes the baseline again in the same change
  (`scripts/evals.sh --baseline`).
- **Typecheck, lint, tests, and the docs check pass on every commit** (`bun run check`).
- **Stage only the files you changed;** never `git add -A`.
- **Mocks live in `docs/design/terminal-screens.html`,** never published outside the repo. A change
  to a screen's design updates its mock in the same change, so the mocks match the screens. Designs
  still being tried go in `docs/design/trying.html`, and move across once built.

## Commands

| Command                       | Does                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| `bun install`                 | Install dependencies (Bun >= 1.3.14)                              |
| `bun run check`               | Typecheck, lint, format check, tests, docs check                  |
| `bun run format`              | Format everything with Prettier                                   |
| `bun run build`               | Compile the `trek` binary into dist                               |
| `bun run build:smoke`         | Compile the render smoke binary into dist                         |
| `bun run check:docs`          | Verify paths and links in current docs, package READMEs           |
| `scripts/evals.sh`            | Run every eval fixture once against the baseline                  |
| `scripts/evals.sh --baseline` | Take the eval baseline again                                      |
| `bun run --cwd site build`    | Build the website into site/dist (after `bun install --cwd site`) |

## Layout

- `packages/core/` — git, schema, prompts, validation, saving and loading treks. No UI.
- `packages/cli/` — the `trek` entry point: arguments, resolving the change, starting a
  front-end.
- `packages/mcp/` — the MCP server, `trek mcp`, for the agent that builds a trek.
- `packages/serve/` — the editor protocol's server, `trek serve`, for editors stepping a trek.
- `packages/tui/` — OpenTUI + React front-end.
- `packages/evals/` — the eval runner: an agent builds a fixture's trek, scored against
  expected.json.
- `packages/testing/` — what every package's tests share: temporary folders, repos, saved
  treks.
- `editors/nvim/` — the Neovim plugin (Lua).
- `editors/vscode/` — the VS Code extension, for VS Code and its forks.
- `evals/fixtures/` — sample repos for trek-quality evals.
- `scripts/` — repo tooling.
- `site/` — the website, srctrek.dev: a static Astro site in its own package, outside the
  workspaces, with the install script at `site/public/install`.
