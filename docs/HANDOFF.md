# Handoff

## 2026-10-23 — Tour schema and an interim home screen

**Done**

- Milestone 2, step 1: the tour schema (`packages/core/src/schema/tour.ts`) and saving,
  loading, and listing tours (`packages/core/src/tours.ts`).
- The spike's Neovim plugin moved into `editors/nvim/` as a prototype.
- Step 2a: each step names where execution came from (`from`), and a link from another
  repo must cite both repos or be marked guessed. Validation messages name the step id.
- An interim TUI home screen: run `bun packages/tui/src/main.tsx` in a repo to list
  the .codetrail/tours folder and open a tour in Neovim.

**Known gaps**

- The Neovim plugin has no automated tests or Lua formatter yet.

## 2026-10-22 — Quality spike

**Done**

- Fixture `evals/fixtures/refund/`: a refund feature across a TypeScript web client, a
  TypeScript API, and a Python worker, with a planted units bug; ground truth in
  `evals/fixtures/refund/expected.json`.
- A reviewer agent, given only the three repos, built a 20-step tour: every ground-truth
  step in order, both hops, all cited lines valid, and the planted bug found with correct
  numbers. It also raised five real unplanted issues.
- Weaknesses: the queue hop's link was a topic-name match across repos but cited only one
  side and was not marked guessed; 13 of 20 steps carried `uncertain`, burying the bug.
- Follow mode works in Neovim: stepping from inside the editor, step highlight, one-line
  narration, `+`/`~` signs on changed lines, a details popup. Judged workable by the user.

**Not yet tested**

- A real multi-repo PR, read by the user without running anything.
- Larger and messier code than the fixture.

## 2026-10-20 — Milestone 1: skeleton and docs

**Done**

- Milestone 0: OpenTUI 0.6.6 + React compiles to a single working binary. Verified on
  macOS arm64 by hand, and on Linux x64, Linux arm64, and macOS by the CI smoke job.
- Milestone 1: workspace layout, docs, typecheck, lint, format, tests, docs check, CI.
- Product sharpened: trigger to outcome, across repos, from local ranges or pull requests,
  driving the editor, with evidence on every link (`docs/PRODUCT.md`, `DECISIONS.md`).

**Milestones**

- 2: cli package; repos and ranges from local paths or GitHub PR URLs; base detection; remote
  fetch into a cache; reading files at a revision; editor worktrees; tour schema (with
  severity on `uncertain` and the cross-repo evidence rule); save and load.
- 3: tour building across repos through `trail mcp`: read tools, prompts, submission and
  validation (schema and cited lines); `trail` launching the user's agent when there is no
  tour; tours of existing code from a picked trigger; the build loop's retry limit;
  updating stale tours through the agent; evals driving an agent headless, including a
  fixture that is hard to read statically, one whose trigger is in an unchanged file, and
  one that crosses repos.
- 4: core as a long-lived process (`trail serve`) with the stepping session and the editor
  protocol (`docs/PROTOCOL.md`); the Neovim plugin (stepping,
  narration, change signs, details, stale steps marked, keys configurable through `setup`, a
  Lua API beside the commands); the TUI's home screen (with
  version, stale, and unreachable states), build view, route map, and fallback stepping view.
- 5: asking from the editor: `trail ask`, answers through MCP, notes on steps, branch trails
  for what-if questions.

**Version 1 scope:** see `DECISIONS.md`; deferred work in `docs/ROADMAP.md`.

**Open**

- Check the name before going public.
- Whether `trail` with no arguments includes uncommitted changes.
- Whether OpenTUI is still worth its native code and pre-1.0 risk for the TUI's narrower
  role: review after Milestone 2.
- WSL not yet tested.
- `bun test` would collect `*.test.ts` files inside eval fixtures.
- `tsconfig.json` covers only `packages/*/src`, `packages/*/test`, and `scripts`; code under
  `evals/` is not typechecked or type-aware linted.
