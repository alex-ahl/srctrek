# Handoff

## 2026-10-20 — Milestone 1: skeleton and docs

**Done**

- Milestone 0: OpenTUI 0.6.6 + React compiles to a single working binary on macOS arm64.
  Linux binaries cross-compile and embed the Linux native library; running them is
  covered by the CI smoke job, not yet observed passing.
- Milestone 1: workspace layout, docs, typecheck, lint, format, tests, docs check, CI.
- Product sharpened: trigger to outcome, across repos, from local ranges or pull requests,
  driving the editor, with evidence on every link (`docs/PRODUCT.md`, `DECISIONS.md`).

**Next: quality spike, before Milestone 2**

- A hand-written tour of a single-repo pipeline exists outside the repo.
- Run that pipeline on made-up input with call tracing and compare against the tour.
- Value test: questions on the flow, tour against a plain chat explanation.
- Follow-mode script: step the tour and drive the editor.
- The deciding test: a tour of a real multi-repo PR the user has already reviewed, judged
  without running anything.

**Milestones**

- 2: cli package; repos and ranges from local paths or GitHub PR URLs; base detection; remote
  fetch into a cache; reading files at a revision; editor worktrees; tour schema; save and load.
- 3: tour building across repos through `trail mcp`: read tools, prompts, submission and
  validation (schema and cited lines); evals driving an agent headless, including a fixture that is hard to read statically, one whose trigger is in
  an unchanged file, and one that crosses repos.
- 4: TUI controller and Neovim following: stepping, call stack, details, collapsing context
  and trivial steps, code panel when the editor can't follow.

**Version 1 scope:** see `DECISIONS.md`; deferred work in `docs/ROADMAP.md`.

**Open**

- Whether `trail` with no arguments includes uncommitted changes.
- WSL not yet tested.
- `bun test` would collect `*.test.ts` files inside eval fixtures.
- `tsconfig.json` covers only `packages/*/src`, `packages/*/test`, and `scripts`; code under
  `packages/core/schema/` and `evals/` is not typechecked or type-aware linted.
