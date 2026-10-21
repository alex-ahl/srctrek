# Architecture

## Shape

```
local repos / PR URLs ──► core ◄──► mcp ◄──► user's agent
                           │
                           ▼
              tour (.codetrail/tours/<name>.json) ──► tui ──► editor
                                                      (gui later)
```

- **`packages/core/`** — everything that is not presentation: resolving repos and ranges,
  fetching remote refs, reading and searching files at a revision, preparing editor
  checkouts, prompts, the tour schema, validation, saving and loading tours. Exposes its API only
  through `packages/core/src/index.ts`.
- **`packages/tui/`** — the terminal controller (OpenTUI + React): overview, current step,
  call stack, keys, and driving the editor. Holds no tour-building logic.
- **mcp (Milestone 3)** — the MCP server (`trail mcp`, stdio) that the user's agent talks to.
  Exposes core's capabilities as MCP tools and prompts. Holds no tour logic of its own.
- **cli (Milestone 2)** — the `trail` binary's entry point: parses arguments, resolves repos
  and ranges through core, and starts a front-end. Until it exists, the entry point is
  `packages/tui/src/main.tsx`. Front-ends never import each other.
- **GUI (later)** — a local web front-end served by the same binary (`trail --gui`), using
  the same core API and tour format.

## Boundaries

- core imports no UI code; oxlint enforces this (`no-restricted-imports` in `.oxlintrc.json`).
- Front-ends import only `@codetrail/core`; oxlint rejects deep and relative imports into it.
- The tour schema is the contract between core and every front-end.
- Prompts are files under `packages/core/prompts/`, imported as text
  (`import x from "./x.md" with { type: "text" }`) so the compiled binary embeds them.
  Nothing reads them from disk at runtime.
- A submitted tour is validated against the schema, and every cited file and line range
  must exist at its revision. Errors go back to the agent to fix.

## Sources

- A repo is a local path or a remote URL; a pull request URL resolves to a repo plus a range
  through its fetchable ref (`refs/pull/<n>/head` on GitHub, equivalents elsewhere).
- Remote repos are cloned into a cache as partial bare clones with the user's git credentials.
- Files are read at a revision through git objects, never from the working tree. The one
  exception is uncommitted changes, when the range includes them.
- For the editor, each repo is checked out at the tour's revision into a cached worktree
  (`git worktree add`), so the editor shows the code the tour describes.

## Specs

Specs are read alongside the code:

- Contract files in the repos: OpenAPI, protobuf, AsyncAPI, GraphQL schemas.
- Design docs, ADRs, and agent plans in the repos.
- PR descriptions and linked issues, through the host's CLI (`gh`, `glab`) when installed.
- Files or URLs passed with `--spec`.

They set the scenario and serve as evidence: a route or topic in a contract file links a
caller to its handler without a guess. The code decides the route; where a spec and the
code disagree, the step is flagged `uncertain`.

## Tour format

Defined in code under `packages/core/schema/`. Saved as `.codetrail/tours/<name>.json`.

- `format_version`, `title`, `created_at`, `prompt_hash`, `overview`
- `author`: `{ role, agent, model }` — role is `producer` (the agent that wrote the change) or
  `reviewer` (an independent reading); `agent` is absent when core built the tour itself
- `sources`: the specs read, each `{ kind, location }`
- `trigger`: `{ kind, input }` — kind is a request, event, schedule, or command; input is the
  scenario's concrete example
- `outcome`: what the scenario ends in
- `repos`: `{ name, source, revision, range? }[]` — `source` is a path or URL; a repo on the
  path without changes has no range
- `steps[]`:
  - `id`, `repo`, `file`, `start_line`, `end_line`, `summary`, `details`
  - `blob`: the file's git blob id at the tour's revision; a mismatch marks the step stale
  - `kind`: `call`, `return`, `hop` (async or cross-process: the call stack resets), or `context`
  - `changed`: whether the range touches these lines
  - `via`: the evidence for arriving here — `{ repo, file, line }` of the call site, route,
    config line, message name, or spec entry — plus `guessed: true` when the link is a
    name match
  - optional: `predicted_values`, `calls` (id of the step stepped into), `uncertain`, `trivial`

## Building a tour

The user's agent builds the tour through `trail mcp`:

1. `open_change`: the agent names local paths, ranges, or PR URLs; core resolves repos,
   revisions, and ranges, fetches what's remote, and returns the change.
2. Read tools: `diff`, `read_file`, `search`, and `list_files`, at each repo's revision. They
   work the same for local and remote repos, and never touch the working tree.
3. Instructions: the schema and the guidance from `packages/core/prompts/`, as MCP prompts.
4. Submission: `start_tour` (trigger, outcome, overview), `add_steps`, `finish_tour`. Each
   call is validated; the TUI shows the overview as soon as `start_tour` lands and steps as
   they arrive.

## Following in the editor

On each step the TUI moves the editor to the step's file and line in the cached worktree.

- Neovim (version 1): `nvim --server <socket> --remote-send` to a running instance, which
  also highlights the step's range.
- Every other editor: `e` opens the step at its line with the editor's open-at-line command.

Editor plugins (inline summaries, stepping from inside the editor) are optional adapters.

## Modes

Narrated only: tours are built by reading code, not running it. Values shown for the
scenario are predictions and are labeled as predicted. Recorded runs (a debugger, a tracer,
or a test) serve only as ground truth in evals.

## Evals

Each fixture under `evals/fixtures/` is a base tree plus a patch. The eval runner builds a
temporary git repo from them, runs an agent headless against `trail mcp` to build a tour,
and checks the result.

## Distribution

A single binary from `bun build --compile`, per platform. The OpenTUI native library is
embedded in the binary. CI compiles and runs a render smoke binary on Linux and macOS.

## Open for later

Designed not to block anything in `docs/ROADMAP.md`.
