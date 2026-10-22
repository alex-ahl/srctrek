# Architecture

## Shape

```
local repos / PR URLs ──► core (trail process) ◄──► mcp ◄──► user's agent
                           │        ▲
                           ▼        │ JSON over stdio
        tour (.codetrail/tours/<name>.json)   ├── Neovim plugin (stepping, in the editor)
                                              └── tui (home, build view, route map, fallback)
```

- **`packages/core/`** — everything that is not presentation: resolving repos and ranges,
  fetching remote refs, reading and searching files at a revision, preparing editor
  checkouts, prompts, the tour schema, validation, saving and loading tours, and the
  stepping session (current step, next, into, out, call stack) that every front-end and
  editor adapter renders. Exposes its API only
  through `packages/core/src/index.ts`. Runs as a long-lived `trail` process that editor
  plugins talk to over JSON on stdio, the way language servers do.
- **Neovim plugin (Milestone 4)** — Lua, in an editors directory beside `packages/` (one
  folder per editor). The main place a tour is followed. Renders core's stepping session in
  the editor: highlights, one-line narration, change signs, details, asking. Holds no
  stepping logic of its own. Talks to core through `docs/PROTOCOL.md`.
- **`packages/tui/`** — the terminal front-end (OpenTUI + React) for everything around
  stepping: a home screen of tours and PRs awaiting review, ranked by high-severity flags; a
  live view while a tour is built; a route map of the whole trail across repos; and a
  fallback stepping view with a code panel for editors without a plugin. Holds no
  tour-building logic.
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
  - `via`: the evidence for arriving here — one or more `{ repo, file, line }` citing the
    call site, route, config line, message name, or spec entry — plus `guessed: true` when
    the link is a name match. A link that crosses repos cites both sides or is guessed;
    validation rejects anything else.
  - optional: `predicted_values`, `calls` (id of the step stepped into), `trivial`, and
    `uncertain`: `{ severity, note }`, severity `high` (likely wrong behaviour), `medium`
    (risky), or `low` (worth knowing). Front-ends show `high` inline and the rest in details.
  - `notes[]`: questions asked on this step and their answers (see Asking)

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

The agent is started one of two ways:

- From the agent's own chat, with `trail mcp` registered.
- By `trail` itself, when there is no tour for the change: it runs the user's agent CLI
  headless with `trail mcp` attached, detected and launched as for Asking, and shows the
  build view while the tour arrives.

Without a change (a repo the user doesn't know), `trail` builds a tour of existing code: the
agent proposes candidate triggers (CLI commands, HTTP routes, event handlers, scheduled
jobs), the user picks one or types their own, and the tour follows it with every step
unchanged and no range.

A tour from anywhere — an agent, a teammate, written by hand — is validated when loaded:
the schema, cited lines at their recorded revisions, and steps whose files changed since
marked stale.

## Following in the editor

The tour is stepped in the editor, in files from the cached worktree.

- Neovim (version 1): the plugin steps from inside the editor and renders each step.
- VS Code and its forks (after version 1): an extension, rendering the same session.
- Every other editor: the TUI's fallback stepping view shows the code, and `e` opens the
  step at its line with the editor's open-at-line command. No integration beyond that is
  planned.

## Asking

The user asks a question about the current step from the editor; codetrail runs the user's
agent to answer it.

1. The editor sends the question, the current step, the call stack, and any selected lines
   to `trail ask`.
2. `trail ask` builds the prompt from `packages/core/prompts/` and runs the user's agent CLI
   headless, with `trail mcp` attached for reading code at the tour's revisions.
3. The agent answers through an MCP tool. Core validates the answer like a tour: cited lines
   exist, values are labeled predicted.
4. The editor shows the answer beside the code with jumpable citations, and core saves it on
   the step as a note.

Answers by kind: explain (text with citations), navigate (locations), what-if (a branch
trail from the current step), verify (a flag raised, lowered, or cleared, with the reason).

The agent CLI is detected from those installed; one setting overrides it.

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
