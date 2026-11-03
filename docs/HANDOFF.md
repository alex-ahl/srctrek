# Handoff

## 2026-10-30 — Milestone 4: `trail serve`

**Done**

- Step 4a: context steps name the step they explain (`for`) in place of `from`, citing both
  repos when the two differ, and execution never comes from or steps into one; `calls` lists
  the steps a step steps into, in call order. The Neovim prototype steps into the first.
- Step 4b: call stacks worked out from the links (`callStacks`), with a return that comes back
  to no frame rejected and `from` always naming an earlier step; `calls` removed. The guide
  says code that runs later in response to something is a hop. The refund tour's split
  function is one step, its click handler a hop.
- Step 4c: the evals score call stacks: each fixture names lines and the frames, by file, that
  every step showing one must sit under (`stacks` in expected.json). The guide says a response
  coming back to the caller awaiting it is a return, an event handled at once is a call, and a
  call through a lookup cites where its target is registered.
- Step 4d: the stepping session in core (`openSession`, `stepNext`, `stepBack`, `stepTo`,
  `stepInto`, `stepOver`, `stepOut`): pure moves on an immutable session, over and out by the
  functions running at each step, a hop inside its caller only when it's answered.
- Step 4e: the session's view (`sessionView`), ready to render: overview, end, or the step with
  its path in its checkout, narration, flag, values, changed lines, stale, calls, context steps,
  and its call stack across every hop. Checkouts, changed lines, and stale steps come in a
  `ViewContext` the caller prepares.
- Step 4f: the view's context from git (`viewContext`): each repo checked out at the tour's
  revision, the lines its range touches, and stale steps given the change as it is now (the
  tour records commits, not branches, so the caller supplies the change). A missing repo or
  commit is an `UnreachableRepoError` naming it.
- Step 4g: the protocol's messages in core (`RequestParams`, `ErrorCode`, `PROTOCOL_VERSION`,
  `TRAIL_VERSION`): requests answer with the view; open takes a tour by name and, for stale
  steps, trail's arguments. `docs/PROTOCOL.md` describes version 1: stepping.
- Step 4h: `trail serve` (`packages/serve/`): JSON-RPC over stdio through `vscode-jsonrpc`, the
  handshake, and each request carried out on the stepping session in order, answered with its
  view; failed requests leave the state as it was.
- Step 4i: contract tests for `trail serve`: a JSON-RPC client drives the real process through
  the handshake, a whole tour, into, over, out, errors, stale steps, and requests sent together
  behind a slow open, answered in order.

## 2026-10-27 — Milestone 3: tour building

**Done**

- Step 3a: the read tools in core (`packages/core/src/read/`), each on a repo of the
  resolved change at its revision, through git objects only: listing files, reading
  numbered lines, searching with a regular expression (capped at 200 matches), and the
  change's files and a file's patch.
- Step 3b: `trail mcp`, an MCP server over stdio (`packages/mcp/`, on
  `@modelcontextprotocol/server`): `open_change` with `trail`'s arguments, then
  `list_files`, `read_file`, `search`, and `diff`. Tool descriptions are prompt files in
  `packages/core/prompts/tools/`. "mcp" as `trail`'s first word is the command: a
  folder by that name is given as `./mcp`, a branch as part of a range (`main...mcp`).
- Step 3c: predicted values on their lines in the tour format (`{ name, value, line, role,
uncertain? }`, each inside its step's lines), the refund fixture's values placed on their
  lines, and the Neovim plugin drawing them from `predicted_values`, doubtful ones in the
  warning colour.
- Step 3d: a submitted step completed and checked (`packages/core/src/build/`): core adds the
  file's blob and whether the change touches the step's lines, and lists every line the step
  relies on (its range, each citation) that doesn't exist at its repo's revision.
- Step 3e: building a tour over `trail mcp`: `start_tour`, `add_steps` (checked, all or none;
  a step sent again by id replaces it), and `finish_tour` (the whole-tour rules, then saved to
  .codetrail/tours with its changed-lines file). The tool prompts carry the step fields and
  the rules for predicted values.
- Step 3f: `--uncommitted`, for `trail` and `open_change`: each local range ending at HEAD
  ends at a snapshot of the working tree (a commit on top of HEAD under refs/codetrail,
  made with a temporary index), so tours of work in progress cite exact commits too.
- Step 3g: the `build_tour` MCP prompt (`packages/core/prompts/build_tour/`): how to choose
  a scenario, follow it in execution order, link steps with evidence, show its values, and
  flag only what matters; its `change` argument fills in `open_change`'s args. The same
  guide is the `tour_guide` tool, and the server's instructions say to read it first, so
  asking for a tour in plain words works. `trail mcp` started from a terminal says it's
  waiting for a client.
- Step 3h: whether a change already has a tour (a saved tour with every changed repo at the
  same commits), and a name for a new one from its heads: the branch (`feature-refunds`), a
  pull request (`pr-12`), or the branch with `-uncommitted` for a snapshot.
- Step 3i: background builds (`startBuild`, `buildState`): `$CODETRAIL_AGENT` runs detached
  with the headless instruction as its last argument; its log and exit code go to the git
  folder (.git/codetrail/builds). `trail mcp` stops a build at its third rejected round.
- Step 3j: a change's tour status (`tourStatus`): ready, building, failed (with the end of
  the build's log), or missing. Snapshots became stable: dated with HEAD's date and leaving
  .codetrail as HEAD has it, so a tour of uncommitted work is found again.
- Step 3k: `trail` builds the change's tour when it has none and `CODETRAIL_AGENT` is set;
  the home screen shows where it stands (building, failed with the end of its log and `b` to
  build again, how to set `CODETRAIL_AGENT`, or nothing to tour when the change has no
  commits) and picks out the tour once it's saved.
- Step 3l: citation checks catch lines off by one: a step's first and last line, each
  citation, and each predicted value's line must not be blank.
- Step 3m: `--code[="trigger"]` for tours of code as it is: repos only, local ones at HEAD
  (or a snapshot with `--uncommitted`) unless pinned, the trigger kept on the resolved
  change. Status, naming, and building for them come next.
- Step 3n: `trail --code` builds tours of code as it is: the guide opens for code (with the
  trigger the user named, or one the agent picks) and shares its method with change tours;
  code tours are named after the trigger or `<repo>-code` and found again only while their
  repos are at the same revisions.
- Step 3o: watching a build: `trail mcp` appends each answer it gives the agent to the
  build's log as a `trail:` line; the home screen shows the log's end while building and `l`
  opens it all. Reading a build's state no longer creates its folder. A build that saved its
  tour, whose tour was then removed, reads as missing, so the tour is built again.
- Step 3p: plain `--code` finds triggers instead of building a tour: the agent records them
  with `record_triggers` (kind, a name in the user's words, a cited line, checked like any
  citation), they're saved in .codetrail/triggers tied to the revisions, and the home screen
  lists them with the command that tours each.
- Step 3q: the found triggers are rows on the home screen: each says whether its tour is
  built, building, or failed; enter builds it, or opens it once built, and `l` shows the
  selected build's log.
- Step 3r: read tools that stay small on large repos: `list_files` lists one level (folders
  ending in "/") unless `recursive`, at most 500 entries; `read_file` returns at most 400
  lines without `to`, saying how many the file has; `diff` lists at most 200 files and cuts a
  patch at 600 lines. Each says what was cut and how to reach the rest.
- Step 3s: git work that stays fast on large repos: a snapshot starts from a copy of the
  user's index (keeping its times, so git's check of recently changed files still works),
  so only changed files are re-read; the cache fetches only the default branch, a pull
  request's ref, and revisions or range ends named by the user.
- Step 3t: the eval runner (`packages/evals/`, `bun packages/evals/src/main.ts <fixture>`):
  builds a fixture's repos, has `CODETRAIL_AGENT` build the tour of the change in
  expected.json's `run`, and reports route reached and in order, each expected link cited,
  guessed, both, or without evidence, bug lines inside steps, time taken, and the numbers in
  the agent's last line when it is JSON. First runs on refund: 10–11 of 11 route entries,
  both links, all bug lines; 34–35 turns, 430–540k input and 10–12k output tokens.
- Step 3u: fixture `expire`, whose trigger is in unchanged files: the change touches only cart
  storage (a new time helper with a planted bug); a nightly schedule names the job, a registry
  maps the name to it, and an admin route is a second, lesser caller. Every fixture's
  expected.json is checked against its built repos: each cited line exists and isn't blank.
- Step 3v: fixture `points`, hard to read statically, among unrelated files: a Python app whose
  model save emits an event named from the model's kind, handled by a decorator in a plugin
  imported by name from settings; the change moves loyalty points to that event, and the bug
  (points awarded on every save) shows only in the unchanged checkout.
- Step 3w: fixture `uploads`, in Go: the handler hands a job to worker goroutines over a channel,
  the worker stores it through an interface whose implementation is picked from the
  environment, and the change passes the request's context to the worker, which net/http
  cancels once the handler answers.
- Step 3x: a bug counts as found only when a step flagged high covers one of its lines (a bug
  line merely inside a step was met by every route-following tour); the report also counts
  flagged steps by severity. All four fixtures scored perfect under the old check. A fixture
  lists every line where its bug can fairly be flagged, and can mark a route entry optional
  (plumbing, or evidence the links check already scores); skipping one isn't a miss.
- Step 3y: `propose_repo`: the agent proposes a repo the route leads into, with a name, a
  source, a reason, and cited evidence; it's recorded in proposed-repos.json under .codetrail,
  and only the user adds it to the repos list (`acceptProposal`) or dismisses it. The guide
  ends a hop at the boundary and proposes the repo.
- Step 3z: proposed repos are the first rows on the home screen, with source and reason;
  enter adds one to the repos list, d dismisses it. A tour already built doesn't take the new
  repo until it's rebuilt.
- Step 3aa: finding where a proposed repo lives: `open_change` names git repos next to the
  current one that aren't opened (other worktrees of the same repo left out); the agent looks
  there first, then on the code host with its own tools. When it finds nothing it proposes
  without a source, and enter on that row asks the user for a path or URL.
- Step 3ab: a proposed repo with a source is opened in the same build (at its default branch,
  its path relative to the current repo), so the tour goes on into it and records it; only
  keeping it on the repos list waits for the user. The answer reminds the agent that a hop
  into it cites both sides or is guessed.
- Step 3ac: nearby repos for real layouts: found around the folder that holds the git data
  (a clone, or a project folder keeping a bare repo beside its worktrees, which is read as a
  repo too); each says whether it has a branch the work is on (never the base branch), and
  those come first when more than 50 are found.
- Step 3ad: a proposed repo is read on the work's branch, as part of the change, when it has
  it; else at a pinned revision, or at its default branch with the reason. The answer tells
  the agent to flag the hop medium when the repo is read at its default branch, or its branch
  is behind its upstream as of the last fetch (nothing is fetched). The eval runner can start
  in one repo: `bun packages/evals/src/main.ts refund web main...feature`.
- Step 3ae: the reviewer's case: the work's branch is also found for a pull request (the host
  branch at its head, through `git ls-remote`) and for a range on remote-tracking branches
  (`origin/main...origin/feature`); a sibling with only `origin/feature` is read from it, as of
  the last fetch, and the agent is told to say so in the tour.
- Step 3af: `--reviewer` for the eval runner: a fixture's repos built as clones of stand-in
  hosts, the work only on `origin/feature`.
- Step 3ag: fixture `checkout`: the service the shop calls `payments` lives in a folder named
  `pay-backend`, beside a decoy `api` with similar routes and its own `feature` branch; the
  planted bug is a field name that differs between the two sides. Runs start in `shop` alone.
  Repos are scored by the folder they were read from, and decoys stepped into are reported.
- Step 3ah: stale tours: a tour saved under the change's name at commits the change has moved
  on from is `stale`, counting the steps whose files changed since; the home screen says so,
  and `trail` no longer rebuilds it on its own.
- Step 3ai: updating a stale tour: `b` starts a build told to update it. `update_tour` carries
  over the steps whose files and cited files are unchanged, at the new commits, and lists the
  rest with why; redone steps go back to their places, and `finish_tour` takes a revised title,
  overview, or outcome. A step whose own files are unchanged can still be wrong when code it
  calls changed; the agent is told to look over steps next to the ones it redid.
- Step 3aj: `--update` for the eval runner: build, commit the fixture's follow-ups, update, and
  report both runs; `refund` has one (an error message changed in place in api's handler).
  First run: the update took about 385k input tokens and 45 s against the build's 433k and 98 s,
  14 steps carried over and 3 redone, the tour still fully correct.
- Step 3ak: the build log gets a line for every read and for the guide, with the answer's size:
  `trail: read_file api src/pay.ts 1–40 → 1210 chars`.
- Step 3al: `update_tour` answers with the whole tour, one line per step marked keep or redo
  (with why and what it said before), and asks the agent to read only what the redone steps
  need. The logs had shown an update re-reading every file of all three repos to redo three
  steps. On refund: about 256k input and 3k output tokens in 37 s, against the build's 610k and
  14k in 135 s; updates before took 370–385k input tokens.

**Closed 2026-10-29.** Tours are built through `trail mcp` by the user's agent, in chat or
headless; the agent proposes repos the route leads into and the tour goes on into them; stale
tours are marked and updated; evals score quality and measure token use.

**Eval baseline** (one or two runs each; input tokens are mostly the context re-read per turn)

| Run                                          | Score               | Turns | Input / output tokens |
| -------------------------------------------- | ------------------- | ----- | --------------------- |
| refund, all repos named                      | full                | 34–36 | 430–560k / 10–12k     |
| refund from web alone, repos proposed        | full                | 36    | 650k / 10k            |
| refund as a reviewer (`--reviewer`)          | full                | 42    | 830k / 12k            |
| expire (trigger in unchanged code)           | full                | 19–21 | 320–350k / 7k         |
| points (hard to read statically)             | full                | 28–30 | 390–505k / 7–8k       |
| uploads (Go, channel hand-off)               | full                | 19–20 | 320–350k / 5–7k       |
| checkout (misnamed service, decoy)           | full, decoy avoided | 26    | 440–480k / 12k        |
| refund `--update` after a one-line follow-up | full                | 15    | 256k / 3k             |

**Known gaps**

- The Neovim plugin has no automated tests or Lua formatter yet.

**Milestones**

- 4: core as a long-lived process (`trail serve`) with the stepping session and the editor
  protocol (`docs/PROTOCOL.md`), with contract tests.
- 5: front-end design pass: flows, screens, and a shared visual language for the TUI, the
  editors, and a GUI, as mockups reviewed before anything is built; the TUI library chosen
  against those screens.
- 6: the editors on the protocol, side by side: a VS Code extension (also for its forks),
  shipped as a .vsix package to beta testers, and the Neovim plugin; each with stepping,
  narration, change signs, details, stale steps marked, configurable keys, and asking
  (`trail ask`, answers through MCP, notes on steps, branch trails for what-if questions).
- 7: the TUI to the design: home screen (with version, stale, and unreachable states, and
  tours built with an older guide, whose prompt hash differs from the current one), build
  view, route map, and fallback stepping view. `trail` and `trail mcp` report the commit
  they were built from instead of version 0.0.0, and tours record it.
- 8: a GUI sharing screens with the VS Code extension, if beta testers want it.

The beta release follows milestone 6: the `trail` binary and the .vsix package.

**Version 1 scope:** see `DECISIONS.md`; deferred work in `docs/ROADMAP.md`.

**Open**

- Check the name before going public.
- Stop ignoring the .codetrail folder once tours are written with portable sources; clear
  out local-only files (demo tours, changed-lines files) first.
- OpenTUI, reviewed after Milestone 2: kept for now (about 12.5 MB of the binary, about 40
  lines of use, all in `packages/tui`). Revisit at Milestone 5 against the designed screens,
  or sooner if an upgrade costs more than a day or a target platform fails to load it.
- Context steps: next visits them in tour order, so one placed early sits before the step it
  explains, and `for` names one step. Decide in Milestone 5, with the design, whether context
  stays in the steps list or becomes a tour-level list whose entries name every step they
  explain.
- One function reached from two callers: a step names one `from`, so the second caller has
  no step to step into.
- The refund tour's s3 (web's `renderOrder`) comes from the api's handler (s2), so its stack
  says the api calls it.
- Progress from trail serve: a first open of a remote tour (clone, fetch, worktree) and asking
  take seconds to a minute in silence. Add a progress notification with asking in Milestone 6.
- Large repos: editor worktrees should check out only the files a tour visits (sparse
  checkout), with the editors in Milestone 6.
- Token use: most of it is the context re-read every turn as it grows, so turns matter more
  than answer sizes; the build log's per-read lines show where they go. Runs vary, so compare
  guide versions over several runs.
- Proposed repos: a sibling is read on the work's branch only when it has one of the same name
  (locally or remote-tracking); otherwise at its default branch, with the hop flagged.
- Headless builds search the code host or read pull request descriptions only when the
  agent command in `CODETRAIL_AGENT` allows read-only host tools.
- Nearby repos: only the folder around the current repo is scanned, not nested layouts such
  as `~/git/org/repo` across organisations.
- An updated tour keeps a step whose own files are unchanged, which can still be wrong when
  code it calls changed.
- Accepting a proposal whose source pins a branch (`<url>@feature`) pins the repos list to it.
- WSL not yet tested.
- `bun test` would collect `*.test.ts` files inside eval fixtures.
- `tsconfig.json` covers only `packages/*/src`, `packages/*/test`, and `scripts`; code under
  `evals/` is not typechecked or type-aware linted.

## 2026-10-26 — Milestone 2: git, repos, and the `trail` command

**Done**

- Step 2a: each step names where execution came from (`from`), and a link from another
  repo must cite both repos or be marked guessed. Validation messages name the step id.
- Step 2b: reading a range (`main...feature`, `main..feature`, or a head alone) and resolving
  it to exact commits, detecting the base branch when none is given
  (`packages/core/src/git/`).
- Step 2c: reading a file and its blob id at a commit, the files that changed between two
  commits, and a file's changed lines numbered as in the new version.
- Step 2d: eval fixtures built into real git repos (`main` and `feature` branches) for tests;
  the refund tour is checked against them: blob ids match and every cited line exists.
- Step 2e: repos without changes, read from `.codetrail/repos` (one `path[@revision]` per
  line, `#` comments allowed) and resolved to an exact commit at the default branch or the
  pinned revision (`packages/core/src/repos/`).
- Step 2f: a repos-list line can name its repo (`payments = ../payments-service`), and a
  repo is found by the name the code calls it. Proposing repos while building
  (`propose_repo`) is part of Milestone 3.
- Step 2g: a pull request URL read as a clone URL plus the ref its head is fetched from, by
  the URL's shape (GitHub's `/pull/<n>`, GitLab's `/-/merge_requests/<n>`), so
  self-hosted instances work too.
- Step 2h: remote repos cached as partial bare clones under `$XDG_CACHE_HOME/codetrail`
  (else `~/.cache/codetrail`), one per host and path; fetching updates branches and pull
  request refs. Git never prompts for a password; logins come from the user's git setup.
- Step 2i: a pull request resolves through the cache to its repo and range (branch point on
  the host's default branch to the pull request's head); repos-list URLs resolve through the
  cache too, at the default branch or a pinned revision.
- Step 2j: the folder the editor opens for a repo at a commit: the user's own checkout when
  it's there unedited, else a worktree under the cache, detached at the commit.
- Step 2k: `trail`'s arguments read into changes (ranges, pull requests) and repos on the
  route (`packages/core/src/change/`), with errors for paths that aren't there, ranges
  without a repo, and pull requests git can't fetch.
- Step 2l: a whole change resolved to every repo at an exact commit: the changes (local or
  remote ranges, pull requests), then repos given without a range, then the current repo's
  repos list; each repo kept once, names unique.
- Step 2m: the `cli` package, `trail`'s entry point (`packages/cli/src/main.ts`): reads the
  arguments, resolves the change, says what's wrong with arguments it can't use, then opens
  the home screen. Nothing uses the resolved change until Milestone 3.

## 2026-10-23 — Tour schema and an interim home screen

**Done**

- Milestone 2, step 1: the tour schema (`packages/core/src/schema/tour.ts`) and saving,
  loading, and listing tours (`packages/core/src/tours.ts`).
- The spike's Neovim plugin moved into `editors/nvim/` as a prototype.
- An interim TUI home screen, listing the .codetrail/tours folder and opening a tour in
  Neovim; started by `trail` since step 2m.

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
