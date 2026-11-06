# Handoff

## 2026-11-03 — Milestone 6: the editors

**Done**

- Step 6a: next and prev pass over context steps, which the step they explain offers; a step's
  number counts the executed steps, and a context step takes the number of the step it explains.
  Readers see stop numbers, never step ids; the guide numbers executed steps without gaps and
  gives a context step its step's id plus a letter (`s8a`).
- Step 6b: a step can carry a `name`, the function, route, or handler it shows, and the view
  passes it on, so the call stack and the route list `createRefund`, not a sentence; the guide
  asks for it. Tours without names still load.
- The evals count a bug line in a context step as flagged by the step it explains, which the reader
  opens it from; the expire tour that flagged `daysAgo` for `DAY_MS` now scores the bug found.
- Step 6c: what the editors will need from the terminal's code, moved into core: the saved tours
  with their summaries (`loadTourEntries`), building or updating the change's tour
  (`buildChangeTour`), and reading `CODETRAIL_AGENT` (`agentCommand`). Behaviour unchanged.
- Step 6d: `trail serve` answers `tours` (the saved tours and the change's status), `build`
  (builds or updates the change's tour; error 7 without an agent), and `log`; an unreadable
  change is error 8. The tour list counts stops, as stepping does.
- Step 6e: the Neovim plugin on `trail serve`: `:Trail <name>` starts it and opens the tour,
  every move is a request, and the plugin draws the view it gets to the visual language (stop
  number and call stack in the winbar, `≈` values, the high flag under the narration, stale
  steps, a count of context steps). Step over is on `<leader>tn`. Its stepping logic and tour
  reading are gone. Headless Neovim tests drive it against the real server; they're skipped
  where `nvim` isn't installed, as in CI. The terminal opens a tour in Neovim by name, with its
  own `trail serve`.
- Step 6f: a line that makes a call the tour follows ends in `→` (`↯ api` for a hop into another
  repo), from the line the entered step's evidence cites, and step into takes the call on the
  cursor's line, else the first not yet visited. This replaces the into picker. A call citing
  no line of the step is listed under the code.
- The Neovim plugin leaves the user's setup alone: the window's own winbar comes back off a step
  and on quit, and a move closes only the plugin's own popups, not another plugin's float.
- Knowing where the tour is, in Neovim: the step has a tint of its own (`ColorColumn`, not the
  cursor line's), `▶` on its first line, the winbar says `away` once the
  cursor leaves the step, and `<leader>tc` (`:TrailCurrent`) goes back without moving the tour.
- Knowing you're in a tour, in Neovim: a `codetrail` badge starts the winbar; the narration sits on a band across the window. The step's tint, the band, and
  the badge are mixed from the theme's text, background, and info colours, checked across
  Neovim's built-in themes, dark and light: no theme group is distinct in all of them.
- Reading a step, in Neovim: the stop number is the winbar's strongest text; a file the change
  adds whole gets a "new file" tag instead of a `+` on every line; the step opens near the top
  without scrolling past a short file's end; the band has a `▌` edge, and stays distinct from
  the tint on light themes. `scripts/nvim-screen.lua` captures the plugin's screen as text and a
  picture, for checking a change across colour schemes.
- A tour loses nothing of the user's: the tab it had is gone, and each window it draws in gets
  back its file, cursor, and scroll on quit. A buffer it replaces stays loaded while the tour
  runs, so with 'hidden' off its unsaved changes and undo history survive and the step still
  opens.
- A step opens the user's own file when its content is the tour's version, decided per file, so
  a branch that moved on since keeps opening the user's files; a file that differs opens from
  the tour's copy in the cache, read-only, with "tour's version" in the winbar. The copy is
  checked out only when some file differs.
- Details show where a step came from: the earlier step by its stop number, `→` for a cited
  link and `⇢` for one guessed by name, and the lines its evidence cites. Enter on the link goes
  to that step, on an evidence line opens it, on a context step opens that. The float is plain
  text coloured by line, so it reads the same without a markdown plugin.
- The winbar's call stack reads outermost first, `viewContext › ownCheckout`, cut from the left
  when it doesn't fit; the step's place is its repo and short path, the full path being in the
  status line.
- The band holds only the narration, flush left, and at its end a risky or worth-knowing flag;
  the narration names background code, and the winbar tags a step "existing code" or "new file"
  beside its stop number.
- The end of a tour lists every flag, most severe first, each with its stop and place; enter on
  one goes to its step.
- The band wraps the narration at about 90 characters, up to six lines, however wide the window.
- `<leader>tx` shows a step's context code (contracts, types, where its data came from) in a
  float over the step, each piece under its reason; `q` closes it, enter opens a piece as a step.
  On steps that have any, the winbar says "context available"; the overview names the key.
- The band's text starts in the code's column, with half a row of padding above and below; the
  step's tint runs from the window's left edge, under its signs and line numbers, and the band's
  bottom padding turns into it, so band and step read as one block.
- Details say where a step came from as "Reached from stop N · name", with each cited line and its
  code under it, so the evidence reads without opening it.
- The call stack goes back only across hops whose caller waits for an answer; a hop nobody waits
  on starts a fresh stack, `started by api: publish ↯ worker: poll_once`, and a frame across a hop
  into another repo names it (`post ↯ api: POST /refunds`). The view carries `started_by`.
- The band ends with where next goes, `next: into requestRefund, line 11`, `next: ↯ api: POST
/refunds`, `next: back to createRefund`, or `next: the end of the tour`, and the arrow on the
  line next enters from is bold. The view carries `next`.
- Predicted values read `name ≈ value` (`returns ≈ 250`, `name ≈? value` when doubtful), each
  cut at about 40 characters; details show them whole in the same form.
- The tour's arrows and values come first at a line's end, before diagnostics and other plugins'
  text, which Neovim draws in order of priority.
- A tour's read-only copy opens with its diagnostics hidden until the tour ends; the user's own
  files keep theirs.
- Step 6g: the VS Code extension's skeleton, in `editors/vscode` (in the workspaces, under `bun run
check`): "Codetrail: Open Tour…" lists the tours in a quick pick, `Alt+]` and `Alt+[` step, each
  step opens its file with its lines tinted, and the status bar shows the stop. Its client for
  `trail serve` has no VS Code API in it and is tested against the real server; the extension
  bundles none of core's code. The VS Code layer's checks run inside the installed VS Code, with a
  profile of their own, through `bun editors/vscode/test/run-in-vscode.ts`, run by hand on a
  machine with a desktop session.
- The VS Code extension shows each stop's narration in full, wrapped, in a read-only comment
  thread above the step (the line before it; below the first line on a file's first line), with
  "codetrail" and "stop N of M" in its header. Next and previous moved to `F8` and `Shift+F8`, only
  while no debug session runs.
- VS Code steps over, into, and out on `F10`, `F11`, and `Shift+F11`; into takes the call on the
  cursor's line, else the first not visited. Each line making a call ends in `→` (`→?` guessed,
  `↯ repo` into another repo), bold on the line next enters from, and a move with nowhere to go
  says so in the status bar and leaves the cursor.
- `bun editors/vscode/test/capture-vscode.ts <tour> <out-dir>` steps a saved tour in the installed
  VS Code, maximized in a profile of its own, and saves a PNG of the main screen at the overview,
  each stop, and the end. Run by hand on a machine with a desktop session; macOS asks once for the
  terminal's Screen Recording permission. The extension's commands answer with the view they leave
  the tour on.
- The VS Code narration panel wraps; carries a high flag under the narration, a risky or
  worth-knowing flag and where next goes after it, and the step's tags in its header (existing code
  or new file, guessed link, context available, tour's version, stale). A tour's copy of a file
  opens read-only for the session.
- VS Code shows predicted values at the ends of their lines, `name ≈ value` in the inlay-hint colour
  and `≈?` in the warning colour, cut at 40 characters; "Codetrail: Show or Hide Values" toggles
  them.
- VS Code's overview and end open in a tour tab (a webview in the theme's colours, its own script
  only): the overview has the story, trigger, outcome, repos, flag counts, and the keys; the end has
  the outcome and every flag, each a link that goes to its stop through `goto`. Stepping onto a
  stop closes the tab.
- VS Code's sidebar, in the Explorer: Codetrail Tours lists the saved tours (from a `trail serve`
  started for the listing; refresh in its title bar), each opening on a click; Codetrail Stop, a
  webview, shows the stop's call stack newest first (hops `↯`, "started by"), where it came from
  with each cited line's code (a link opens it; "guessed" when it is), the flag, values, details,
  context steps, and questions, each stop a link. The route (every stop in order) isn't in the
  protocol's views, so the sidebar doesn't list it.
- The prototype's asking (`<leader>ta`) is gone: its prompt was written in the plugin, not in
  `packages/core/prompts/`. Asking comes back later through `trail serve`.
- A guessed link shows where it's met: "guessed link" in the winbar of the step it reaches, `→?`
  on the line it was guessed from.
- The winbar: the stop number and its tags, then the place as `repo: path`, the repo in its own
  colour, then the stack, its frames below the step's dimmed, split by a dim `│`; "away" at the
  right end.
- A crisper flow, from a walk through every screen: quitting a fresh Neovim leaves its window
  empty again (Neovim had reused the start buffer for the tour's first file); opening says so at
  once and binds the keys, so a key pressed meanwhile no longer runs Neovim's own `]t`
  (`:tnext`); a move with nowhere to go says so and leaves the cursor; the overview lists the
  repos, flag counts, and the keys; floats fit their text; nothing sits under the step's code any
  more.

## 2026-11-03 — Milestone 5: design pass

**Done**

- Step 5a: the flows, in `docs/DESIGN.md`: reviewing a pull request or work in progress, learning
  unfamiliar code, coming back to a stale tour, building from the agent's chat, asking, stepping
  without a plugin, and what happens when it doesn't work. A session starts from the terminal
  (enter opens the editor `CODETRAIL_EDITOR` names) or from the editor (which lists, opens, and
  builds tours).
- Step 5b: the visual language, in `docs/DESIGN.md` and a review page: each role's look, wording,
  and the theme colour it follows in Neovim and VS Code; the call stack newest frame first; context
  steps opened from the step they explain, not visited by next.
- Step 5c: the editor screens, in `docs/DESIGN.md` and a review page: choosing a tour, the
  overview, a step, details, stepping into one of several calls, the end, and asking, in Neovim
  (no sidebar, floats) and VS Code (CodeLens and a sidebar); VS Code steps with the debugger's
  keys.
- Step 5d: the terminal screens, in `docs/DESIGN.md` and a review page: the home screen and every
  state of a change's tour, the build view, the route map in lanes per repo, and stepping in the
  terminal for anyone, not only editors without a plugin.
- Step 5f: OpenTUI kept for the terminal, judged against the designed screens and an Ink build of
  the route map (Ink adds about 1 MB against OpenTUI's 14 MB, but the screens need nothing it
  does better). The GUI's design waits until beta testers ask for one. OpenTUI upgraded from
  0.6.6 to 0.8.1, with no changes to our code.

**Closed 2026-11-03.** `docs/DESIGN.md` says how every surface looks and behaves: the flows, one
visual language that follows the editor's theme, the editor screens in Neovim and VS Code, and the
terminal screens, each reviewed as a mockup. The terminal keeps OpenTUI, kept up to date until 1.0.

**Walking an agent-built tour (refund eval, 2026-11-04)**

Stepping it with `]t` alone, the reader couldn't tell what happened or what each step does. The
guide's narration was rewritten first; on a second walk the story connected from stop to stop,
background code came with its reason, and the queue hop was cited (refund eval: route 10/10, both
links cited, bug flagged high, stacks 4/4, 39 turns). The guide items below are done; the screen
follows, one small step each.

From the second walk:

- The tour's title is long and repeats the route: the guide now asks for a few words; to check on
  the next walk.
- Details' "came from" listed places without what they show: done, below.
- A contract a step crosses or implements (a spec entry, a schema, a message's type) is often the
  key fact at a boundary: in the refund tour, the spec says amounts are in minor units and web
  sends 499 major. The narration should name the contract and the term that matters ("the spec
  says amount is in minor units; web sends 499"), since stop 5's didn't: now in the guide; to check
  on the next walk. Fuller version: the roadmap's boundary cards.
- A contract must be easy to find: done with `<leader>tx`, below.

What the agent writes (`packages/core/prompts/`):

- Background code comes with the reason to look, in words, in the narration ("the order id and
  amount come from `renderOrder`, which drew the button"), not a name and place tacked on the
  band. The most important item.
- Narration of a few sentences when a step needs it: what happens, and why it matters for the
  scenario.
- Each stop says how it follows from the last, most of all after a return or a hop ("once the
  api answers 202…"). To be tested on the walk after the guide changes.
- Values that decide the path first, and short (`<button refund o_1001 499>`, not the markup).
- A step that receives a request is named by its route (`POST /refunds`), not "HTTP server".
- A call through a lookup cites its call site as well as where the target is registered.
- A link is guessed only when no cited line proves it: a shared topic, URL, or config value cited
  on both sides is cited, and a remaining doubt is a low flag. The guide currently says both.

The tour format:

- A guessed link carries what was assumed and how to check it.
- Context steps stay, or become a "see also" list with a reason each: still to decide.

The screen:

- The band says where `]t` goes next: done, below.
- A hop nobody waits on (a queue, an event) starts a fresh stack, and the stack names the repo at
  a hop: done, below.
- "unchanged" says that the step is existing code the flow passes through.
- Values read `name ≈ value`: done, below.
- The tour's marks come before diagnostics at a line's end: done, below.
- Diagnostics are hidden in the tour's read-only copies: done, below.
- Later, if beta testers ask: a guessed link's evidence in the quickfix list.
- The away note placed where it doesn't shift the winbar: done, below.
- The winbar's parts get colour and clearer separators: done, below.
- Later, if beta testers ask: the step event names the file's repo root, so a file tree can follow
  into another repo.

**Known gaps**

- The Neovim plugin has no Lua formatter yet.

**Milestones**

- 6: the editors on the protocol, side by side, to `docs/DESIGN.md`: a VS Code extension (also
  for its forks), shipped as a .vsix package to beta testers, and the Neovim plugin; each with
  stepping, narration, change signs, details, stale steps marked, configurable keys, the list of
  tours, and asking (`trail ask`, answers through MCP, notes on steps, branch trails for what-if
  questions).
- 7: the TUI to `docs/DESIGN.md`: home screen (with version, stale, and unreachable states, and
  tours built with an older guide, whose prompt hash differs from the current one), build
  view, route map, and stepping view. `trail` and `trail mcp` report the commit
  they were built from instead of version 0.0.0, and tours record it.
- 8: a GUI sharing screens with the VS Code extension, if beta testers want it.

The beta release follows milestone 6: the `trail` binary and the .vsix package.

**Version 1 scope:** see `DECISIONS.md`; deferred work in `docs/ROADMAP.md`.

**Open**

- The overview float, later: `1 stops` reads `1 stop`; repos and flags show only when there's
  something to say; wrapped trigger and outcome lines hang under their text; one line of keys
  (`]t next · [t back · <leader>tt details · ? keys`) with the full list behind `?`. Check how
  long the agent's overviews run in the evals, and whether the prompt needs a limit.
- Check the name before going public.
- Stop ignoring the .codetrail folder once tours are written with portable sources; clear
  out local-only files (demo tours, changed-lines files) first.
- OpenTUI stays, kept up to date with each release until 1.0; it's at 0.8.1.
  Revisit if an upgrade costs more than a day or a target platform fails to load it.
- A context step's `for` names one step, so a context step can't explain several.
- Over and out count a hop as inside its caller only when a return comes back across it: in a
  tour that never shows a request's response, over from the caller stops inside the handler.
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

**Closed 2026-11-03.** Editors step through a tour by talking to `trail serve`: core holds the
stepping session (next, prev, into, over, out, goto) over call stacks worked out from the
tour's links, and answers each request with a view ready to render. Evals score the stacks
agents build.

**Eval baseline** (one run each, with Step 4c's guide; Milestone 3's baseline stands for the
runs not repeated)

| Run                                | Score | Stacks | Turns | Input / output tokens |
| ---------------------------------- | ----- | ------ | ----- | --------------------- |
| refund, all repos named            | full  | 4/4    | 37    | 506k / 18k            |
| expire (trigger in unchanged code) | full  | 2/2    | 22    | 386k / 9k             |
| points (hard to read statically)   | full  | 1/1    | 28    | 405k / 8k             |
| uploads (Go, channel hand-off)     | full  | 1/1    | 21    | 365k / 7k             |
| checkout (misnamed service, decoy) | full  | 3/3    | 26    | 486k / 13k            |

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
