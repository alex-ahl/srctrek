# Handoff

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
  both links, all bug lines; 34–35 turns, 430–540k input tokens, about $0.60.
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

**Known gaps**

- The Neovim plugin has no automated tests or Lua formatter yet.

**Milestones**

- 3: tour building across repos through `trail mcp`: an "add a repo" tool for the agent,
  approved by the user; updating stale tours through the agent; evals driving an agent
  headless, reporting each tour's quality and token cost, including a fixture that is hard to
  read statically, one whose trigger is in an unchanged file, and one that crosses repos.
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
- Context steps sit in the execution chain: the format requires `from` on every step after
  the first, so a step read for context (not executed) has to claim execution came from
  somewhere. Decide with the protocol in Milestone 4: a separate link for context steps.
- `calls` holds one step, so a function that steps into several (a handler calling five
  helpers) can offer only one for step into. Decide with the protocol in Milestone 4.
- Large repos: editor worktrees should check out only the files a tour visits (sparse
  checkout), with the editors in Milestone 6.
- Token cost of building a tour: about 430–540k input tokens on the small refund fixture,
  mostly the context re-read every turn as it grows; the agent's own tools and connectors
  add a few thousand per turn. Levers: fewer turns (bigger batches of reads and steps) and
  smaller answers. Runs vary, so compare guide versions over several runs.
- WSL not yet tested.
- `bun test` would collect `*.test.ts` files inside eval fixtures.
- `tsconfig.json` covers only `packages/*/src`, `packages/*/test`, and `scripts`; code under
  `evals/` is not typechecked or type-aware linted.

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
