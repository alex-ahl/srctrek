# Architecture

## Shape

```
local repos / PR URLs ──► core (trek process) ◄──► mcp ◄──► user's agent
                           │        ▲
                           ▼        │ JSON-RPC over stdio (trek serve)
        trek (.srctrek/treks/<name>.json)   ├── Neovim plugin (stepping, in the editor)
                                              └── tui (landing page, change screens, builds, stepping)
```

- **`packages/core/`** — everything that is not presentation: resolving repos and ranges,
  fetching remote refs, reading and searching files at a revision, preparing editor
  checkouts, prompts, the trek schema, validation, saving and loading treks, and the
  stepping session (current step, next, into, over, out, call stack) that every front-end and
  editor adapter renders. Exposes its API only
  through `packages/core/src/index.ts`. Runs as a long-lived `trek` process that editor
  plugins talk to over JSON on stdio, the way language servers do.
- **`editors/nvim/`** — the Neovim plugin (Lua), the main place a trek is followed:
  highlights, narration, change signs, details, context code. Depends on no file
  explorer; each step fires a `User SrctrekStep` event that explorers or user config can
  follow. Every action is a command (`:TrekNext` and so on) and a Lua function; keys exist
  only while a trek is active and are set through `setup({ keys = … })` or
  `vim.g.srctrek`, where any can be changed or turned off. No integrations with other
  plugins: users wire which-key, explorers, and the like to the commands, functions, and
  the step event themselves. It starts `trek serve` and draws the views it answers with
  (`docs/PROTOCOL.md`), holding no stepping logic of its own.
- **`editors/vscode/`** — the VS Code extension, for VS Code and its forks, on the same protocol:
  it starts `trek serve` in the workspace folder and draws the views it answers with. It imports
  only core's types, so its bundle holds none of core's code.
- **`packages/tui/`** — the terminal front-end (OpenTUI + React) for everything around
  stepping: a landing page of the changes to look at, each with its trek's state; a change's
  screen, where its trek is built and shown; a route map of the whole trek across repos; and a
  stepping view with a code panel, for a quick look and for editors without a plugin. Holds
  no trek-building logic.
- **mcp** — the MCP server (`trek mcp`, stdio, `packages/mcp/`) that the user's agent talks
  to. Exposes core's capabilities as MCP tools and prompts. Holds no trek logic of its own.
- **serve** — the editor protocol's server (`trek serve`, stdio, `packages/serve/`), started
  by an editor's plugin: carries out each request on core's stepping session and answers with
  its view. Holds no stepping logic of its own.
- **cli** — the `trek` binary's entry point (`packages/cli/`): parses arguments, resolves
  repos and ranges through core, and starts a front-end. Front-ends never import each other.
- **GUI (later)** — a local web front-end served by the same binary (`trek --gui`), using
  the same core API and trek format.

## Boundaries

- core imports no UI code; oxlint enforces this (`no-restricted-imports` in `.oxlintrc.json`).
- Front-ends import only `@srctrek/core`; oxlint rejects deep and relative imports into it.
- The trek schema is the contract between core and every front-end.
- Prompts are files under `packages/core/prompts/`, imported as text
  (`import x from "./x.md" with { type: "text" }`) so the compiled binary embeds them.
  Nothing reads them from disk at runtime.
- A submitted trek is validated against the schema, and every cited file and line range
  must exist at its revision. Errors go back to the agent to fix.

## Sources

- A repo is a local path or a remote URL; a pull request URL resolves to a repo plus a range
  through its fetchable ref (`refs/pull/<n>/head` on GitHub, equivalents elsewhere).
- `trek`'s arguments are pull request URLs, repos (a folder or URL, optionally
  `@revision`), and ranges. A range applies to the repo just before it, or to the current
  repo when none is; a repo with no range after it is on the route without changes. With no
  arguments, the change is the current branch since it left the base branch:
  `trek ../api main...feature ../web main...feature ../gateway`.
- `--code` walks code as it is, with no change: every argument is a repo (the current one
  when none is given), local repos are read at what's checked out unless pinned, and
  `--code="a refund request"` names the trigger to follow. Plain `--code` builds no trek: the
  agent records the code's triggers (`record_triggers`, each with a cited line as evidence),
  saved in .srctrek/triggers while the code is at the same revisions, and the user picks.
- Repos on the route without changes have no range. They come from the command (a repo
  given without a range, e.g. `trek main...HEAD ../gateway`) or from the repos list
  (`.srctrek/repos`, one path or URL per line, optionally `@revision`), read
  automatically; their revision is the default branch unless pinned, recorded as an exact
  commit.
- A line in the repos list can name its repo: `payments = ../payments@v2.3`. The name is what
  the code calls the service, so a call to `payments` resolves to that repo. Without a name,
  the repo is named after its project's folder, so every worktree of a project shares its name.
- While building, the agent proposes repos it finds on the route with `propose_repo`, citing
  the evidence (a client, a config value, a contract file, a dependency), with the source
  when it finds it: `open_change` names git repos next to the current one as candidates, and
  the agent can search the user's code host with its own tools; srctrek doesn't search hosts
  itself. A proposal with a source is opened at once, so the trek goes on into it and records
  it: on the branch the work is on, as part of the change, when the repo has it, locally or
  as a remote-tracking branch as of the last fetch; else at its default branch, and the trek
  flags the hop as possibly missing the change's side there.
  With the user's approval the repo is appended to the repos list under its name; for a
  proposal without a source, the user gives the location when adding it.
- A repo given or listed more than once, or listed and also changed, is kept once; two
  repos can't share a name, since steps name their repo.
- Remote repos are cloned into a cache as partial bare clones with the user's git credentials.
- Files are read at a revision through git objects, never from the working tree.
- Uncommitted work is left out unless asked for (`--uncommitted`): then each
  local range ending at HEAD ends instead at a snapshot of the working tree, a commit on top
  of HEAD (edits staged or not, new files git doesn't ignore), made without touching the
  branch, the index, or any file, and kept by a ref under refs/srctrek. The .srctrek
  folder stays as HEAD has it, and the snapshot is dated with HEAD's date, so the same work
  always gives the same commit and its trek is found again.
- For the editor, each repo is checked out at the trek's revision into a cached worktree
  (`git worktree add`), so the editor shows the code the trek describes. The user's own
  checkout serves instead when it's at that revision with no edits to tracked files.

## Specs

Specs are read alongside the code:

- Contract files in the repos: OpenAPI, protobuf, AsyncAPI, GraphQL schemas.
- Design docs, ADRs, and agent plans in the repos.
- PR descriptions and linked issues, through the host's CLI (`gh`, `glab`) when installed.
- Files or URLs passed with `--spec`.

They set the scenario and serve as evidence: a route or topic in a contract file links a
caller to its handler without a guess. The code decides the route; where a spec and the
code disagree, the step is flagged `uncertain`.

## Trek format

Defined in code in `packages/core/src/schema/trek.ts`. Saved as `.srctrek/treks/<name>.json`.

A step's narration (summary and details) is about the step's own lines. Any other code it
mentions is a citation, `<repo>/<path>:<line>`, which the editor can jump to and validation
can check; never a bare "line 5".

- `format_version`, `title`, `created_at`, `prompt_hash`, `overview`
- `author`: `{ role, agent, model }` — role is `producer` (the agent that wrote the change) or
  `reviewer` (an independent reading); `agent` is absent when core built the trek itself
- `sources`: the specs read, each `{ kind, location }`
- `trigger`: `{ kind, input }` — kind is a request, event, schedule, or command; input is the
  scenario's concrete example, its values marked in pairs, `amount: «40»`; screens set them
  apart, plain text drops the markers
- `outcome`: what the scenario ends in, its values marked the same way
- `repos`: `{ name, source, revision, range?, head? }[]` — `source` is a path or URL; a repo on
  the path without changes has no range. A changed repo's `head` names what its range ended at
  when the trek was built: `{ kind: "branch", name, uncommitted }`, or
  `{ kind: "pull" | "merge-requests", number }`
- `steps[]`:
  - `id`, `repo`, `file`, `start_line`, `end_line`, `summary`, `details`
  - optional: `name`, the function, route, or handler the step shows, as the code names it
  - `blob`: the file's git blob id at the trek's revision; a mismatch marks the step stale
  - `kind`: `call` (enters a function), `return` (comes back to a function a step on the
    call stack showed), `hop` (cross-process, or later: a message, a job, an event handler; the
    call stack resets), or `context`
  - `changed`: whether the range touches these lines
  - `from`: the id of the earlier step execution came from, on every executed step but the
    first; for async work it names the cause (the publish), not the step before it in the
    trek. A context step is never executed, so `from` never names one.
  - `for`: on a context step, in place of `from`: the step it explains. Context steps sit
    outside the execution chain and the call stack.
  - `via`: the evidence for arriving here — one or more `{ repo, file, line }` citing the
    call site, route, config line, message name, or spec entry — plus `guessed: true` when
    the link is a name match; on a context step, the line of the step it explains that uses
    it. When `from` or `for` is in another repo, the evidence cites both repos
    or the link is guessed; validation rejects anything else. On a hop, `through` says what
    carries it in a few words ("via the agent", "on a timer"); every hop after the first step
    has one, and no other step does.
  - optional: `predicted_values`: `{ name, value, line, role, uncertain? }[]`, role
    `argument`, `assignment`, or `return`, each on a line inside the step: values from the
    example scenario under the same names across steps, where they tell the reader something
    or let them follow the scenario. Front-ends show each at the end of its line, marked as
    predicted, and let the user hide them.
  - optional: `trivial`, and
    `uncertain`: `{ severity, note }`, severity `high` (likely wrong behaviour), `medium`
    (risky), or `low` (worth knowing). Front-ends show `high` inline and the rest in details.
  - `notes[]`: questions asked on this step and their answers (see Asking)

Each executed step's call stack comes from these links, in trek order: a call goes on top of
the step it came from, a hop starts a new stack, and a return takes the place of the nearest
frame in its own file below the step it returns from, found back across hops to their cause.
A step's calls are the steps that come from it as calls. Validation rejects a return that
comes back to no frame.

## Building a trek

The user's agent builds the trek through `trek mcp`:

1. `open_change`: the agent names local paths, ranges, or PR URLs; core resolves repos,
   revisions, and ranges, fetches what's remote, and returns the change.
2. Read tools: `diff`, `read_file`, `search`, and `list_files`, at each repo's revision. They
   work the same for local and remote repos, and never touch the working tree.
3. Instructions: the schema and the guidance from `packages/core/prompts/`, as MCP prompts.
4. `propose_repo`: a repo on the route that the change doesn't include, with its evidence;
   see Sources.
5. Submission: `start_trek` (trigger, outcome, overview), `add_steps`, `finish_trek`. Each
   call is validated: `add_steps` checks each step's lines and links (where execution came from,
   its evidence) as it's added, `finish_trek` the trek as a whole; the TUI shows the overview as soon as `start_trek` lands and steps as
   they arrive.

Setting up: `set_agent_command` saves the command that runs the agent headless to the user's
settings, after running it once with a short instruction; asked to set srctrek up, the agent
passes its own. Its description and answers stay out of the prompt hash, as they don't change
how a trek is built.

The agent is started one of two ways:

- From the agent's own chat, with `trek mcp` registered.
- By `trek` itself, on `b`, or as it opens when there is no trek for the change and building
  automatically is on: it runs the agent's command (the user's settings, or `SRCTREK_AGENT`,
  which overrides them) in the background, as for Asking, with the instruction (the guide, the
  change's args, and the trek's name) as its last argument. The agent reaches `trek mcp`
  through the user's own registration. The build goes on if `trek` quits; its log and exit
  code are kept in the repo's git folder, and the build view shows the trek when it arrives.
  `trek mcp` appends a `trek:` line to that log for each answer it gives the agent, so the
  log shows the build's progress next to the agent's own output.

Without a change (a repo the user doesn't know), `trek` builds a trek of existing code: the
agent proposes candidate triggers (CLI commands, HTTP routes, event handlers, scheduled
jobs), the user picks one or types their own, and the trek follows it with every step
unchanged and no range.

A trek from anywhere — an agent, a teammate, written by hand — is validated when loaded:
the schema, cited lines at their recorded revisions, and steps whose files changed since
marked stale.

## When validation fails

While a trek is built, each submission is checked against every rule, and failures go back to
the agent as messages naming the step. A failed link has two ways out: cite the missing
evidence, or mark the link `guessed`. At the third rejected round, the build stops and the
build view shows the failures; nothing is saved and nothing is fixed silently.

Checks that read the code at the trek's revisions (cited lines exist; the two sides of a
cross-repo link share a distinctive string such as a route or topic) downgrade a link to
`guessed` instead of rejecting the trek.

A saved trek has passed every rule. When one doesn't load:

- **Other format version** (a teammate's trek from another srctrek): one plain message
  naming the version, and an action to rebuild it.
- **Otherwise invalid:** reported as a srctrek bug, since saving and building never let one
  through.
- **Stale** (a cited file's blob changed since): the trek opens with stale steps marked, and
  an action asks the agent to update them.
- **Unreachable** (a repo isn't where the trek says): the change's screen names the repo and the
  expected location.

## Following in the editor

The trek is stepped in the editor, in files from the cached worktree. Core's stepping session
(`packages/core/src/session/`) moves through it:

- next and back: the executed steps in trek order, from the overview to the end; context steps
  are opened from the step they explain.
- into: a step the current one calls or starts a hop to, the first not yet visited unless one
  is named.
- over: the next step not inside what the current step calls.
- out: the next step outside the current step's function.
- A hop counts as inside its caller only when a return comes back across it, as a response does
  to its request; an event, a message, or a scheduled job runs on its own.

After each move the session gives a view ready to render (`sessionView`): the overview, the end,
or the step with its path in the repo's checkout, its narration, flag, predicted values, the
lines the change touches in its file, whether it's stale, the steps it can step into, the context
steps that explain it, and its call stack back across every hop to the trigger, hops marked.
What the view needs from git comes from `viewContext`: each repo found from its source and checked
out at the trek's revision, the lines its recorded range touches, and, given the change as it is
now, the steps whose file has moved on. A repo that isn't where the trek says, or lacks its
commit, is reported by name.

- Neovim (version 1): the plugin steps from inside the editor and renders each step.
- VS Code and its forks (version 1, Milestone 6): an extension, rendering the same session.
- Every other editor: the TUI's stepping view shows the code, and `e` opens the
  step at its line with the editor's open-at-line command. No integration beyond that is
  planned.

## Asking

The user asks a question about the current step from the editor; srctrek runs the user's
agent to answer it.

1. The editor sends the question, the current step, the call stack, and any selected lines
   to `trek ask`.
2. `trek ask` builds the prompt from `packages/core/prompts/` and runs the user's agent CLI
   headless, with `trek mcp` attached for reading code at the trek's revisions.
3. The agent answers through an MCP tool. Core validates the answer like a trek: cited lines
   exist, values are labeled predicted.
4. The editor shows the answer beside the code with jumpable citations, and core saves it on
   the step as a note.

Answers by kind: explain (text with citations), navigate (locations), what-if (a branch
trek from the current step), verify (a flag raised, lowered, or cleared, with the reason).

The agent is the command in the user's settings, or in `SRCTREK_AGENT`, which overrides them;
nothing is detected.

## Modes

Narrated only: treks are built by reading code, not running it. Values shown for the
scenario are predictions and are labeled as predicted. Recorded runs (a debugger, a tracer,
or a test) serve only as ground truth in evals.

## Evals

Each fixture under `evals/fixtures/` is a base tree plus a patch per repo, and an
expected.json: where to run `trek` and with which arguments, the route, the links and their
evidence, the planted bugs, and the call stack expected at a few lines. The eval runner
(`packages/evals/`) builds temporary git repos from them, runs the agent `trek` builds with as
a background build, and scores the saved trek: route entries reached and their order, links
cited or guessed, bugs found (a bug line inside a step flagged high, or inside a context step
whose step is), stacks as expected (every step showing the line under the expected frames, by
file), and how many steps carry flags.

`scripts/evals.sh` runs them with `trek` built from the tree: each fixture named, or every one,
once against `evals/baseline.json`, or with `--baseline` two runs each, written as the new
baseline.

## Distribution

A single binary from `bun build --compile`, per platform. The OpenTUI native library is
embedded in the binary. CI compiles and runs a render smoke binary on Linux and macOS.

## Open for later

Designed not to block anything in `docs/ROADMAP.md`.
