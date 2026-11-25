# Decisions

Newest first. Each entry: the decision, then why.

## 2026-11-25 — The landing page and a change's screen side by side

Where the terminal is 110 columns or wider, the landing page lists the changes on the left, each
by its name and its trek's state, and shows the selected change's own screen on the right. Moving
the selection changes the right side; the change's keys work from the list: `↵` steps its trek, or
builds it when it has none, `e` steps it in the editor, `b` builds, `l` opens its builds. A repo
the agent proposes is added with `y` and dismissed with `x`, leaving `a` to add repos. The `p`, `B`,
and `d` views split the same way. Narrower, the landing page is the list alone and `↵` opens the
change's screen. A change named on the command line opens on its own screen; `esc` goes to the
landing page. "Build automatically" applies where a change opens on its own screen; in the split
view, `↵` on a change with no trek builds it.

The list alone said little: every row's state the same, most of the screen empty, and what a
change holds one screen away. Its screen beside the list shows the change and its trek without
leaving the list, and nothing is drawn twice: what a change holds and its trek's overview are only
on the right. Moving the selection only reads; nothing starts until a key says so.

## 2026-11-25 — trek starts on the landing page, or on what's checked out

`trek` with no arguments starts on one of two screens, chosen by the "Start on" setting:

- **The landing page** (the default): the user's own work first, then the pull requests waiting on
  their review and their own pull requests, then their recent branches and code as it is. Every
  other pull request and branch, and done treks, sit behind a key.
- **What's checked out:** the screen of the checked-out branch with its uncommitted work, or of its
  pull request when it is one. On a base branch with nothing of the user's own, it opens the
  landing page. The screen says what's waiting on the user elsewhere.

`esc` goes from a change to the landing page in either case. A checked-out branch that is a pull
request is that pull request wherever it's opened from: its title, its base, and one trek.

People run `trek` in the repo they work in, and find reviews there rather than by pasting a link,
so the landing page must show what's theirs and what waits on them, and leave the rest of a busy
repo out of the way. Some work one change at a time and come for that change alone; for them the
list is a step in the way. Both read the same screens, so the setting changes only which comes
first.

## 2026-11-18 — Releases are cut by pushing a tag

Pushing a `v<major>.<minor>.<patch>` tag runs `.github/workflows/release.yml`: the checks run,
each binary is built on a runner of its own platform, and one job publishes them with SHA256SUMS
as the tag's GitHub release. A tag with a pre-release part (`v0.1.0-rc.1`) publishes as a
pre-release. The version trek reports (`SRCTREK_VERSION`) isn't stamped from the tag yet and
stays `0.0.0`; versioning comes with release-please, on the roadmap.

The terminal's renderer is a native library per platform, so a binary can't be cross-compiled.
The install script follows `releases/latest`, which skips pre-releases, so a release can be tried
with `SRCTREK_VERSION` before users get it. Checking first keeps a tag on a failing commit from
shipping. Stamping the version waits until releases are regular enough to need it.

## 2026-11-18 — Stepping in the terminal is as good as in the editor

A trek can be stepped in the terminal or in an editor, and which is the user's choice. Stepping in
the terminal is held to the same standard as the editors: the code in its language's colours, the
narration, values, marks, call stack, details, and moves, none of them a lesser version. Both read
the same step view from core, so neither words a step differently.

Some users won't install an editor plugin, use an editor without one, or work over a remote shell;
for them the terminal is the whole experience. Those who step in their editor should lose nothing
by choosing it, and those in the terminal nothing by not.

## 2026-11-16 — The site deploys from master, as a container image

A push to `master` that changes the site builds it and publishes an nginx image with the built
files and `site/nginx.conf` to GitHub's container registry, as `ghcr.io/<repo>-site`, tagged
`latest` and with the commit. The server runs that image behind its own proxy. `development`
stays where work lands; moving `master` forward is the release.

An image carries the server config with the files, so the server needs no copy of either, and
CI needs no access into the server: the server pulls. Deploying from a branch of its own keeps
work on `development` from going live before it's meant to.

## 2026-11-13 — The website is static and self-hosted

srctrek.dev is a static Astro site in `site/`, a package of its own outside the workspaces, built
to plain files and served by a host of our choosing. The install script is a static file at
`/install`; it downloads the binary for the platform from the GitHub release and checks it against
the release's SHA256SUMS. Releases carry `trek-darwin-arm64`, `trek-linux-x64`,
`trek-linux-arm64`, and SHA256SUMS, tagged `v<version>`.

A landing page needs no server, and static files can move hosts without changes. Outside the
workspaces, the site's dependencies stay out of the root lockfile and the binary's build. The
release layout is fixed now so the script and the release workflow, still to come, agree on it.

## 2026-11-12 — Every change can be chosen in the terminal; trek follows the worktree

`trek` with no arguments is the main way in: it opens on the worktree's branch and follows it
while open, picking up new commits, a branch switch, and treks built elsewhere. Every other way
of choosing a change (another branch, a pull request, more repos) can be done from the terminal;
arguments stay as a shortcut for scripts. A repo named without a range will mean its checked-out
branch, passed through unchanged when that's its default branch.

The change can move while trek is open, and one worked out at startup goes stale.
Branches across repos can't be assumed to share a name, and the argument grammar (a range applies
to the repo before it) is hard to read; choosing on screen needs neither.

## 2026-11-10 — Secondary text is mixed from the terminal's own colours

Once the terminal reports its text and background colours, secondary text (help, details,
dates, the footer, rules) is mixed 60% of the way from its background to its text, instead of
taking the theme's dim grey (ANSI 8). A terminal that doesn't report them, or colours set to the
terminal's, keeps ANSI 8.

Many themes draw their dim grey close to the background, and trek puts much of what a screen
says in secondary text, which then read as barely there. A mix from the theme's own colours stays
readable in any theme and still reads as secondary. Narrows "The terminal's states take trek's
own colours" (2026-11-10), which kept dim text the terminal's.

## 2026-11-10 — Settings on S; trek builds on its own only when asked

The terminal has a settings screen on `S`: the editor, the agent's command, building
automatically, and colours, each with its value. The agent's command can live in the settings
file; `SRCTREK_AGENT` overrides it, and settings says so beside the value. Building automatically is off by
default: a change with no trek waits for `b` unless the user turns it on.

Settings people have to discover as environment variables go unset, and the home screen is
where people meet trek. The environment still wins, so scripts, CI, and the evals set the agent
without touching anyone's file. An agent run costs, so starting one shouldn't surprise anyone
who only opened `trek` to look.

## 2026-11-10 — The terminal asks which editor treks open in

Enter on the home screen opens a trek in the editor the user picked. The first time, a picker
lists the editors found on the machine that can open a trek; the choice is kept per user, in
`$XDG_CONFIG_HOME/srctrek/settings.json` (else `~/.config`), and `E` picks again.
`SRCTREK_EDITOR` is gone.

An environment variable had to be found and set before trek opened anything but Neovim, and the
home screen is where people meet trek. Listing only what's installed and asking still assumes no
editor. The setting is per user, not in the repo's .srctrek, which a team shares. Replaces the
editor half of "A session starts from the terminal or the editor" (2026-11-03).

## 2026-11-10 — The terminal's states take trek's own colours

The colours that say how something stands (good, stale, failed, building) and the accent are
trek's own once the terminal reports its background: a bright set on a dark background, deeper
ones on a light one. Default and dim text, and the background, stay the terminal's. A terminal
that doesn't report its colours keeps its own bright ANSI colours. Each state also has a symbol of
its own (`●`, `≠`, `✕`, `◐`, `✓`), so it reads by shape alone.

Themes differ most in green and yellow: in some, ready and stale were hard to tell apart, and the
screen read flatter than the design's mockup. States are signals that must stay apart in every
theme. The shapes keep them readable for anyone who chose a theme for its contrast. Narrows "The
editor's theme colours srctrek" (2026-11-03) for the terminal: these roles only.

## 2026-11-09 — A trek records the branch or pull request it was built from

Each changed repo in a trek names its head: the branch (marked when the trek was of uncommitted
work on it) or the pull request its range ended at. The field is required; treks saved before it
don't load until they're rebuilt.

The range's exact commits say what the trek shows, but not what it's of: with only commits, the
home screen can't tell whether another branch's trek is current, stale, or merged, so it can't
show a state on every trek or group treks by branch. No compatibility path, as the project is
pre-release.

## 2026-11-08 — The beta follows the TUI, as a milestone of its own

Milestone 8 hands srctrek to beta testers: the `trek` binary without a checkout, a clear error
when an editor can't start `trek serve`, and a tester guide. A GUI, if beta testers want one,
moves to milestone 9. Replaces "Beta testers get the binary and a .vsix package after milestone
6" from "Foundation first".

Handing over is work of its own, not a release step at the end of the editors, and testers
should meet the terminal at its designed screens rather than the interim home screen.

## 2026-11-03 — A trek loses nothing of the user's, and has no tab

A trek borrows the user's own windows and gives them back on quit: each window returns to its
file, cursor, and scroll, and a buffer the trek replaces stays loaded while it runs. Nothing a
trek does may throw away unsaved changes, undo history, or a setting.

The trek's own tab was dropped: the badge, the band, and the tint already say a trek is on,
`<leader>tc` goes back to it, and the tab's label was a file path. What it protected, the
user's windows, is restored directly instead. Opening a second Neovim was rejected: Neovim can't
open a terminal itself without assuming the user's terminal or multiplexer, and the user would
lose their buffers and language servers beside the trek.

## 2026-11-03 — Step into follows the cursor; calls are marked at their line

A line making a call the trek follows ends in `→`, and step into takes the call on the cursor's
line, else the first not yet visited. The editors' keys stay their own: Neovim keeps its
defaults, and users map the debugger's keys if they want them.

Readers couldn't tell when a step had somewhere to go, or which call into would take. Placing
the cursor is how a debugger picks one call among several, so no picker or "next call"
marker is needed; the arrow says only what the code can't, that the trek goes there. The line
comes from the entered step's evidence, which every link already cites.

## 2026-11-03 — The terminal keeps OpenTUI

Milestone 7 builds the terminal screens on OpenTUI, kept up to date with each release until 1.0.
Revisited if an upgrade costs more than a day or a target platform fails to load it.

Judged against the designed screens and an Ink build of the route map: Ink adds about 1 MB to the
binary against OpenTUI's 14 MB and is pure JavaScript, but the binary is mostly Bun either way,
and CI's smoke binary already guards the native library. Staying current while it's pre-1.0
keeps each upgrade small, rather than one large jump at 1.0. OpenTUI's renderer and scroll box
suit the build view and the stepping view.

## 2026-11-03 — Anyone can step in the terminal

The terminal's stepping view is for anyone, started with `s` from the home screen or the route
map, not only for editors without a plugin. The editor stays the main place to step. Refines
"The editor is where you step; the TUI is for everything around it" from 2026-10-22.

A quick look at a trek, or at one step from the route map, shouldn't need the editor opened and
pointed at the right checkout; the terminal already shows the route and the code.

## 2026-11-03 — Neovim keeps to the user's windows; VS Code steps with the debugger's keys

The Neovim plugin draws in the user's own windows: virtual lines, the winbar, and floats, with no
sidebar. The VS Code extension narrates in a CodeLens and keeps the route, call stack, details, and
notes in a sidebar, and steps with F10, F11, and Shift+F11 while no debug session runs.

Neovim users arrange their windows with care, and a plugin that opens its own rearranges them.
VS Code has no virtual lines, so the sidebar carries what Neovim shows inline; its debugger's keys
are the stepping keys VS Code users already know.

## 2026-11-03 — The editor's theme colours srctrek; context steps aren't stops

Every visual role (the step, changed lines, predicted values, flags, guessed links, stale steps)
has its own name and defaults to a colour the editor's theme already defines; predicted values
start with `≈`; flags read “likely wrong”, “risky”, and “worth knowing”. The call stack shows the
newest frame on top. Context steps aren't stops: next and prev pass over them, and the step they
explain shows how many it has. Settles “decide in Milestone 5 how context steps show”.

Colours from the theme stay readable in any theme, high-contrast ones included, and a named role
can still be changed alone. A context step that next visits can sit before the step it explains;
reached from that step, it's read where it helps. Newest on top is where every debugger puts the
current frame.

## 2026-11-03 — A session starts from the terminal or the editor

The terminal's home screen opens a trek in the editor `SRCTREK_EDITOR` names; nothing is
detected, and without it `$EDITOR` opens the step at its line. Editors can also list the saved
treks with their status, open one, and start a build, through requests the protocol gains in
Milestone 6.

The home screen can open Neovim but not VS Code, and most beta testers use VS Code and rarely
live in a terminal; the editor needs its own way in. Naming the editor, as `SRCTREK_AGENT`
names the agent, keeps srctrek from assuming one.

## 2026-11-02 — Editor requests answer with the view

Each request from an editor answers with the session's view, ready to render; core pushes
nothing yet. `initialize` carries the protocol version and the client's name, without
capabilities. Version 1 of the protocol is stepping: open, next, prev, into, over, out, goto.
Asking joins it with the editors in Milestone 6; continuing to the next changed or flagged step
stays on the roadmap, and build progress waits for a client that shows it. Replaces "core
pushes ready-to-render payloads" from 2026-10-22.

With one client per process, every change to the session follows a request from that client,
so an answer is enough, and a client needn't match pushed messages to what it sent. Core fits
nothing to what a client can draw, so capabilities would go unread.

## 2026-11-02 — The call stack comes from the trek's links

Each step's call stack is worked out from `from` and its kind: a call goes on top of the step
it came from, a hop starts a new stack, and a return comes back to a frame on the stack. A
return that comes back to no frame is rejected, and code that runs later in response to
something (an event handler, a timer, a callback) is a hop. `next` keeps trek order; step
over and step out skip by the stack. `calls` is gone: a step's calls are the steps that come
from it as calls. Replaces "`calls` lists every step a step steps into" from 2026-10-30.

A stack made from how the reader moved shows nothing when they reach a step with next, so
the editor would show a wrong one. Worked out from the links, it answers "how did I get
here" the same way whatever the route, across hops too. Checked on the treks built so far:
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

## 2026-10-28 — The user chooses what a trek of code is about

A trek of code as it is follows the trigger the user names. With no trigger named, the agent
finds the code's triggers (routes, commands, handlers, jobs), records each with the line that
proves it, and builds nothing; the user picks one to trek.

What a newcomer needs to see first depends on why they're looking, which the agent can't
know; a trek of the wrong path costs minutes of agent time and the reader's attention. The
list of triggers is useful on its own, as a map of how the code is used.

## 2026-10-27 — Asking in plain words builds a trek

A user asks their agent for a trek in their own words; no command or tool name to learn.
`trek mcp` tells the agent at connection, through MCP server instructions, to read the
trek guide first, and the guide is a tool as well as a prompt. The `build_trek` prompt stays
for agents that show prompts as commands.

A guide offered only as a prompt reaches the agent only when the user picks it, and some
agents don't show prompts at all; without the guide, treks come out unguided.

## 2026-10-26 — Uncommitted work only when asked for

`trek` follows committed work by default. `--uncommitted` includes edits, staged or not,
and new files git doesn't ignore, by snapshotting the working tree as a commit on top of HEAD
and using it as the range's head. It comes with Milestone 3, when treks of work in progress
are built before it's committed.

Treks cite exact commits and file versions; uncommitted edits have neither, so by default a
trek can't silently describe code that changes on the next save. A snapshot commit keeps that
guarantee when the user asks for work in progress: everything downstream reads it like any
commit, and further edits mark the trek stale.

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
that builds the trek, which already reads those lines, and validation keeps it inside the
step.

## 2026-10-25 — Repos are named in the repos list; the agent proposes the rest

A line in `.srctrek/repos` can name its repo (`payments = ../payments`), so a call to a
service resolves to a repo without guessing. Repos the list doesn't have are proposed by the
agent through `propose_repo`, each citing its evidence, and added on the user's approval.

Code names services, not git remotes, so a name map is the one reliable link between them,
and committed with the repo it serves every agent and teammate alike. Finding candidates in
manifests and contract files is left to the agent, which reads them anyway; parsers per
ecosystem in core would always be incomplete.

## 2026-10-25 — Foundation first, then a design pass; VS Code and Neovim together in version 1

Order: git (2), trek building (3), core process and protocol (4), a front-end design pass
(5), the VS Code extension and the Neovim plugin side by side on the protocol (6), the TUI
to the design (7), and a GUI only if beta testers want it (8). Beta testers get the binary
and a .vsix package after milestone 6.

The focus moves to front-ends made with care and to outside testers, most of whom use VS
Code; every front-end renders the same stepping session, so building and the protocol come
first and design comes before front-end code. Replaces "VS Code after version 1" from
"Supported editors"; asking from the editor joins milestone 6 instead of being its own
milestone. The Neovim prototype keeps working meanwhile.

## 2026-10-24 — The .srctrek folder is committed, not ignored

The .srctrek folder belongs in the repo: the repos list for the whole team, and treks that travel
with a change. Committed treks must be portable, so repo sources are relative paths or URLs,
never absolute local paths. This repo ignores the folder until srctrek writes portable
treks; then the ignore goes.

## 2026-10-24 — Repos without changes: listed simply, or added while building

A repo the route passes through without changes is given like any repo, minus a range: in
the command, or in `.srctrek/repos`, a plain list of paths and URLs read automatically.
While building, the agent can ask to add a repo it finds on the route; once the user
approves, it's appended to the list. A workspace format was the alternative; a list of lines
needs nothing to learn.

## 2026-10-23 — Failed rules go back to the builder; saved treks are trusted

A failed rule while building goes back to the agent, which cites the missing evidence or marks
the link guessed; after about three rounds the build stops with the failures shown. No
auto-fixing: it would hide the agent's mistakes from it. The one exception is checks that read
the code, which downgrade a link to guessed rather than reject. Saving checks every rule, so a
saved trek that fails to load is another format version (rebuild), stale (open with marked
steps, update through the agent), unreachable, or a srctrek bug. Hand-written treks aren't
a case to design for.

## 2026-10-22 — Supported editors: Neovim, then VS Code and its forks

Full editor integration covers Neovim (version 1) and VS Code with its forks (after version
1, one extension published to both marketplaces). Every other editor gets the TUI's fallback
stepping view and opens steps at their line. An LSP facade and a debug-protocol adapter for
the long tail are not planned: each is another translation layer over core, and these two
editors cover the intended users.

## 2026-10-22 — Editor protocol; editor integrations live in this repo

Editors talk to core over JSON-RPC 2.0 on stdio with language-server framing, through
`trek serve` started by the client. Core owns the stepping session and pushes
ready-to-render payloads; clients hold no logic. An `initialize` handshake checks one integer
protocol version. Messages are defined in core and covered by contract tests that run each
editor client headless against `trek serve`. Specified in `docs/PROTOCOL.md`.

Editor integrations live in an editors directory in this repo while the protocol changes;
every protocol change then touches core and clients in one commit and one CI run. The Neovim
plugin is mirrored into its own repo on release, because plugin managers install from a
repo root. The VS Code extension needs no mirror.

## 2026-10-22 — `trek` builds treks by launching the user's agent; existing code in version 1

With no trek for a change, `trek` runs the user's agent headless with `trek mcp` attached,
the same mechanism as asking from the editor. Without a change, it builds a trek of existing
code from a trigger the user picks among the agent's proposals. Both join version 1. Any trek,
however built, is validated on load.

This restores the one-command flow that building through MCP gave up, still without a model
call of srctrek's own, and covers the onboarding case: a repo the user doesn't know. Moves
"treks of existing code" from the roadmap into version 1.

## 2026-10-22 — The editor is where you step; the TUI is for everything around it

The Neovim plugin is the main surface for following a trek. The TUI covers the rest: a home
screen of treks and PRs awaiting review, a live view while a trek is built, a route map of
the whole trek, and a fallback stepping view for editors without a plugin. Core runs as a
long-lived `trek` process that editor plugins talk to over JSON on stdio.

In the spike, the controller pane went unused once Neovim could step on its own; a separate
pane repeats what the editor shows. The TUI keeps srctrek usable without a supported
editor and gives the overview the editor can't. OpenTUI is reviewed after Milestone 2
against the TUI's narrower role.

## 2026-10-22 — Questions are asked from the editor

The user asks about the current step from the editor; `trek ask` runs the user's own agent
headless with the step's context and `trek mcp` attached, and the answer comes back through
MCP, validated, and saved on the step. Asking from inside the agent's chat was the
alternative; the user wants to stay in the editor. srctrek still makes no model call of
its own. Planned as Milestone 5.

## 2026-10-22 — Severity on flags; cross-repo links cite both sides

`uncertain` carries a severity, and only `high` shows inline. A link that crosses repos cites
evidence on both sides or is marked guessed, enforced by validation. In the quality spike, a
reviewer flagged 13 of 20 steps, so the real bug read like a CORS note, and it cited one side
of a topic-name match across repos without marking it guessed.

## 2026-10-21 — Treks are built by the user's agent, through MCP

`trek mcp` is an MCP server. It resolves repos and ranges, serves git-backed read tools at
the trek's revisions, serves the schema and prompts, and validates the trek the agent
submits. srctrek makes no model call of its own in version 1.

srctrek's users already work with an agent, and that agent already has an exploration
loop, repo access, and a code host CLI; building a second loop is most of Milestone 3 and
asks users for an API key. Replaces the earlier decision that srctrek calls a model API
itself; that becomes a provider-neutral standalone builder in `docs/ROADMAP.md`. Costs: trek quality depends on
the user's agent, and evals drive an agent headless.

## 2026-10-20 — Version 1 scope

- Reviewer treks only: an independent reading of a change.
- Local paths and ranges, plus GitHub PR URLs.
- Neovim follows the trek, with the step's range highlighted; other editors open a step
  with `e`.
- Specs: contract files in the repos (OpenAPI, protobuf, AsyncAPI, GraphQL).

Each cut keeps the core claim testable — cross-repo treks a reviewer can trust — with the
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
trek, so the trek must be checkable by reading.

## 2026-10-20 — The trek drives the editor

Each step moves the user's editor to its file and lines, in a worktree checked out at the
trek's revision; the TUI is the controller. Reading a document or a code panel was rejected:
the point is a debugger session in the user's own editor. Without remote control in the
editor, `e` opens the step instead.

## 2026-10-20 — Multi-repo and pull requests are core

Repos come from local paths or remote URLs, and pull request URLs resolve to a repo and a
range through git. Big features span repos, and reviewers rarely have every repo checked
out on the right branch. Replaces "multi-repo workspaces" as an optional Milestone 5.

## 2026-10-20 — Trigger to outcome

A trek follows the scenario from its trigger to its outcome, including unchanged code on
the path, collapsed by default. Steps have a kind (call, return, hop, context) so async and
cross-process boundaries reset the call stack instead of faking a caller.

## 2026-10-20 — Narrated mode is the point

Not running code is what removes the setup cost of getting every project working. Recorded
mode stays possible but is no longer the expected next mode.

## 2026-10-20 — A cli package owns the entry point

The `trek` binary's entry point moves out of `tui` into its own cli package in Milestone 2.
With `trek --gui` later, an entry inside `tui` would make one front-end import the other,
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

A `core` package with no UI code; front-ends (`tui` now, `gui` later) only read treks from
core. Lets the GUI be added without touching core.

## 2026-10-20 — GUI later: local web front-end

Served by the same binary (`trek --gui`), likely React, sharing core and the trek format.

## 2026-10-20 — TUI: OpenTUI with React

OpenTUI's React reconciler. Pre-1.0, so pinned to an exact version (0.6.6) and the TUI
layer is kept thin. Milestone 0 confirmed it compiles to a single binary with the native
library embedded. Ink is the fallback.

## 2026-10-20 — Language: TypeScript, compiled with Bun

`bun build --compile` produces a single binary, so users need no Node, Bun, or Python.

## 2026-10-20 — Name: srctrek, command `trek`
