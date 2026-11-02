# Decisions

Newest first. Each entry: the decision, then why.

## 2026-11-02 — The call stack comes from the tour's links

Each step's call stack is worked out from `from` and its kind: a call goes on top of the step
it came from, a hop starts a new stack, and a return comes back to a frame on the stack. A
return that comes back to no frame is rejected, and code that runs later in response to
something (an event handler, a timer, a callback) is a hop. `next` keeps tour order; step
over and step out skip by the stack. `calls` is gone: a step's calls are the steps that come
from it as calls. Replaces "`calls` lists every step a step steps into" from 2026-10-30.

A stack made from how the reader moved shows nothing when they reach a step with next, so
the editor would show a wrong one. Worked out from the links, it answers "how did I get
here" the same way whatever the route, across hops too. Checked on the tours built so far:
the misuses found were returns to code no frame was in, which validation now catches, and
one event handler labelled a call, which the guide now covers. Two fields describing the
same calls could disagree; one function reached from two callers is the case `calls` covered
that the links don't.

## 2026-10-30 — Context steps explain a step; a step can step into several

A context step names the step it explains (`for`) instead of where execution came from,
citing both repos when the two differ, and stays off the call stack; execution never comes
from or steps into one. `calls` lists every step a step steps into, in call order.

A context step has no caller, so requiring `from` made it claim one, and the step after it
then claimed to come from code that never ran. With one id in `calls`, a handler calling five
helpers could offer only one of them for step into.

## 2026-10-28 — The user chooses what a tour of code is about

A tour of code as it is follows the trigger the user names. With no trigger named, the agent
finds the code's triggers (routes, commands, handlers, jobs), records each with the line that
proves it, and builds nothing; the user picks one to tour.

What a newcomer needs to see first depends on why they're looking, which the agent can't
know; a tour of the wrong path costs minutes of agent time and the reader's attention. The
list of triggers is useful on its own, as a map of how the code is used.

## 2026-10-27 — Asking in plain words builds a tour

A user asks their agent for a tour in their own words; no command or tool name to learn.
`trail mcp` tells the agent at connection, through MCP server instructions, to read the
tour guide first, and the guide is a tool as well as a prompt. The `build_tour` prompt stays
for agents that show prompts as commands.

A guide offered only as a prompt reaches the agent only when the user picks it, and some
agents don't show prompts at all; without the guide, tours come out unguided.

## 2026-10-26 — Uncommitted work only when asked for

`trail` follows committed work by default. `--uncommitted` includes edits, staged or not,
and new files git doesn't ignore, by snapshotting the working tree as a commit on top of HEAD
and using it as the range's head. It comes with Milestone 3, when tours of work in progress
are built before it's committed.

Tours cite exact commits and file versions; uncommitted edits have neither, so by default a
tour can't silently describe code that changes on the next save. A snapshot commit keeps that
guarantee when the user asks for work in progress: everything downstream reads it like any
commit, and further edits mark the tour stale.

## 2026-10-26 — Predicted values sit on their lines

A predicted value names the line it belongs to and its role: `{ name, value, line, role }`,
role `argument`, `assignment`, or `return`, plus `uncertain: true` when the agent doubts it.
Front-ends show it at the end of that line, marked as predicted (and uncertain ones in the
warning colour), the way a debugger shows inline values; long values are cut at the window
edge, the details view lists them all in full, and one key hides or shows them.

The agent fills them for the example scenario, following its data across steps under the
same names, so a reader can follow one value from where it's made to where it's used. A value
belongs on a line when it tells the reader something or lets them follow the scenario (which
repo, which folder, which record); setup lines that create the scenario's pieces get them
too. Placeholders that restate a parameter's name are noise, and a wrong value sitting in the
code reads more like fact than one in a popup.

Values beside the code they describe read like a debugger session, which is the product's
model; a separate list makes the reader match names to lines. The line comes from the agent
that builds the tour, which already reads those lines, and validation keeps it inside the
step.

## 2026-10-25 — Repos are named in the repos list; the agent proposes the rest

A line in `.codetrail/repos` can name its repo (`payments = ../payments`), so a call to a
service resolves to a repo without guessing. Repos the list doesn't have are proposed by the
agent through `propose_repo`, each citing its evidence, and added on the user's approval.

Code names services, not git remotes, so a name map is the one reliable link between them,
and committed with the repo it serves every agent and teammate alike. Finding candidates in
manifests and contract files is left to the agent, which reads them anyway; parsers per
ecosystem in core would always be incomplete.

## 2026-10-25 — Foundation first, then a design pass; VS Code and Neovim together in version 1

Order: git (2), tour building (3), core process and protocol (4), a front-end design pass
(5), the VS Code extension and the Neovim plugin side by side on the protocol (6), the TUI
to the design (7), and a GUI only if beta testers want it (8). Beta testers get the binary
and a .vsix package after milestone 6.

The focus moves to front-ends made with care and to outside testers, most of whom use VS
Code; every front-end renders the same stepping session, so building and the protocol come
first and design comes before front-end code. Replaces "VS Code after version 1" from
"Supported editors"; asking from the editor joins milestone 6 instead of being its own
milestone. The Neovim prototype keeps working meanwhile.

## 2026-10-24 — The .codetrail folder is committed, not ignored

The .codetrail folder belongs in the repo: the repos list for the whole team, and tours that travel
with a change. Committed tours must be portable, so repo sources are relative paths or URLs,
never absolute local paths. This repo ignores the folder until codetrail writes portable
tours; then the ignore goes.

## 2026-10-24 — Repos without changes: listed simply, or added while building

A repo the route passes through without changes is given like any repo, minus a range: in
the command, or in `.codetrail/repos`, a plain list of paths and URLs read automatically.
While building, the agent can ask to add a repo it finds on the route; once the user
approves, it's appended to the list. A workspace format was the alternative; a list of lines
needs nothing to learn.

## 2026-10-23 — Failed rules go back to the builder; saved tours are trusted

A failed rule while building goes back to the agent, which cites the missing evidence or marks
the link guessed; after about three rounds the build stops with the failures shown. No
auto-fixing: it would hide the agent's mistakes from it. The one exception is checks that read
the code, which downgrade a link to guessed rather than reject. Saving checks every rule, so a
saved tour that fails to load is another format version (rebuild), stale (open with marked
steps, update through the agent), unreachable, or a codetrail bug. Hand-written tours aren't
a case to design for.

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
