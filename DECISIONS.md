# Decisions

Newest first. Each entry: the decision, then why.

## 2026-10-22 — Supported editors: Neovim, then VS Code and its forks

Full editor integration covers Neovim (version 1) and VS Code with its forks (after version
1, one extension published to both marketplaces). Every other editor gets the TUI's fallback
stepping view and opens steps at their line. An LSP facade and a debug-protocol adapter for
the long tail are not planned: each is another translation layer over core, and these two
editors cover the intended users.

## 2026-10-22 — Editor protocol; editor integrations live in this repo

Editors talk to core over JSON-RPC 2.0 on stdio with language-server framing, through
`trail serve` started by the client. Core owns the stepping session and pushes
ready-to-render payloads; clients hold no logic. An `initialize` handshake checks one integer
protocol version. Messages are defined in core and covered by contract tests that run each
editor client headless against `trail serve`. Specified in `docs/PROTOCOL.md`.

Editor integrations live in an editors directory in this repo while the protocol changes;
every protocol change then touches core and clients in one commit and one CI run. The Neovim
plugin is mirrored into its own repo on release, because plugin managers install from a
repo root. The VS Code extension needs no mirror.

## 2026-10-22 — `trail` builds tours by launching the user's agent; existing code in version 1

With no tour for a change, `trail` runs the user's agent headless with `trail mcp` attached,
the same mechanism as asking from the editor. Without a change, it builds a tour of existing
code from a trigger the user picks among the agent's proposals. Both join version 1. Any tour,
however built, is validated on load.

This restores the one-command flow that building through MCP gave up, still without a model
call of codetrail's own, and covers the onboarding case: a repo the user doesn't know. Moves
"tours of existing code" from the roadmap into version 1.

## 2026-10-22 — The editor is where you step; the TUI is for everything around it

The Neovim plugin is the main surface for following a tour. The TUI covers the rest: a home
screen of tours and PRs awaiting review, a live view while a tour is built, a route map of
the whole trail, and a fallback stepping view for editors without a plugin. Core runs as a
long-lived `trail` process that editor plugins talk to over JSON on stdio.

In the spike, the controller pane went unused once Neovim could step on its own; a separate
pane repeats what the editor shows. The TUI keeps codetrail usable without a supported
editor and gives the overview the editor can't. OpenTUI is reviewed after Milestone 2
against the TUI's narrower role.

## 2026-10-22 — Questions are asked from the editor

The user asks about the current step from the editor; `trail ask` runs the user's own agent
headless with the step's context and `trail mcp` attached, and the answer comes back through
MCP, validated, and saved on the step. Asking from inside the agent's chat was the
alternative; the user wants to stay in the editor. codetrail still makes no model call of
its own. Planned as Milestone 5.

## 2026-10-22 — Severity on flags; cross-repo links cite both sides

`uncertain` carries a severity, and only `high` shows inline. A link that crosses repos cites
evidence on both sides or is marked guessed, enforced by validation. In the quality spike, a
reviewer flagged 13 of 20 steps, so the real bug read like a CORS note, and it cited one side
of a topic-name match across repos without marking it guessed.

## 2026-10-21 — Tours are built by the user's agent, through MCP

`trail mcp` is an MCP server. It resolves repos and ranges, serves git-backed read tools at
the tour's revisions, serves the schema and prompts, and validates the tour the agent
submits. codetrail makes no model call of its own in version 1.

Codetrail's users already work with an agent, and that agent already has an exploration
loop, repo access, and a code host CLI; building a second loop is most of Milestone 3 and
asks users for an API key. Replaces the earlier decision that codetrail calls a model API
itself; that becomes a provider-neutral standalone builder in `docs/ROADMAP.md`. Costs: tour quality depends on
the user's agent, and evals drive an agent headless.

## 2026-10-20 — Version 1 scope

- Reviewer tours only: an independent reading of a change.
- Local paths and ranges, plus GitHub PR URLs.
- Neovim follows the tour, with the step's range highlighted; other editors open a step
  with `e`.
- Specs: contract files in the repos (OpenAPI, protobuf, AsyncAPI, GraphQL).

Each cut keeps the core claim testable — cross-repo tours a reviewer can trust — with the
least plumbing. Neovim first: it is the user's editor and the only one whose remote API can
highlight a range. Everything deferred is in `docs/ROADMAP.md`.

## 2026-10-20 — Specs are read alongside the code

Contract files, design docs, PR descriptions, and `--spec` inputs inform the scenario and
count as evidence for links. They carry intent the code can't, and contract files link repos
more reliably than name matching. The code still decides the route; a disagreement with a
spec is flagged rather than resolved. PR descriptions come through the host's CLI so no
host API is required.

## 2026-10-20 — Every link between steps cites its evidence

Each step records the call site, route, config line, or message name that leads to it, and
links matched only by name are marked guessed. The reviewer can't run the code to check the
tour, so the tour must be checkable by reading.

## 2026-10-20 — The tour drives the editor

Each step moves the user's editor to its file and lines, in a worktree checked out at the
tour's revision; the TUI is the controller. Reading a document or a code panel was rejected:
the point is a debugger session in the user's own editor. Without remote control in the
editor, `e` opens the step instead.

## 2026-10-20 — Multi-repo and pull requests are core

Repos come from local paths or remote URLs, and pull request URLs resolve to a repo and a
range through git. Big features span repos, and reviewers rarely have every repo checked
out on the right branch. Replaces "multi-repo workspaces" as an optional Milestone 5.

## 2026-10-20 — Trigger to outcome

A tour follows the scenario from its trigger to its outcome, including unchanged code on
the path, collapsed by default. Steps have a kind (call, return, hop, context) so async and
cross-process boundaries reset the call stack instead of faking a caller.

## 2026-10-20 — Narrated mode is the point

Not running code is what removes the setup cost of getting every project working. Recorded
mode stays possible but is no longer the expected next mode.

## 2026-10-20 — A cli package owns the entry point

The `trail` binary's entry point moves out of `tui` into its own cli package in Milestone 2.
With `trail --gui` later, an entry inside `tui` would make one front-end import the other,
or duplicate argument parsing in each.

## 2026-10-20 — TypeScript 7 with oxlint + Prettier

TypeScript 7.0 (the native Go compiler). typescript-eslint supports only TypeScript `<6.1`,
so linting is oxlint with `oxlint-tsgolint`, whose type-aware rules run on TypeScript 7
itself. It covers floating promises, unsafe `any`, and exhaustive switches, but fewer typed
rules than typescript-eslint's `strictTypeChecked`. Prettier formats. Complexity is capped
with `complexity` (10) and `max-depth` (3).

Rejected: TypeScript 6 with typescript-eslint (stuck on 6 until typescript-eslint supports
7); TypeScript 7 for `tsc` plus an aliased TypeScript 6 for typescript-eslint (two compilers
that can disagree); Biome (shallower type-aware checks).

## 2026-10-20 — CI compiles and smoke-runs the binary

CI builds a smoke binary with `bun build --compile` on Linux and macOS and runs it. The
native OpenTUI library is the likeliest thing to break on an upgrade, and the Linux build
was not run by hand in Milestone 0.

## 2026-10-20 — Architecture: core plus front-ends

A `core` package with no UI code; front-ends (`tui` now, `gui` later) only read tours from
core. Lets the GUI be added without touching core.

## 2026-10-20 — GUI later: local web front-end

Served by the same binary (`trail --gui`), likely React, sharing core and the tour format.

## 2026-10-20 — TUI: OpenTUI with React

OpenTUI's React reconciler. Pre-1.0, so pinned to an exact version (0.6.6) and the TUI
layer is kept thin. Milestone 0 confirmed it compiles to a single binary with the native
library embedded. Ink is the fallback.

## 2026-10-20 — Language: TypeScript, compiled with Bun

`bun build --compile` produces a single binary, so users need no Node, Bun, or Python.

## 2026-10-20 — Name: codetrail, command `trail`
