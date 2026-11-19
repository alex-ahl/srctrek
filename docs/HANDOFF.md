# Handoff

## 2026-11-21 — Milestone 7: stepping in the terminal, the route map, the eval baseline

**Done**

- Builds: the build view lists the steps added with their repo and summary, and scrolls. Every
  build of a trek is kept, the last ten under `.git/srctrek/builds/history/<trek>/`, and `←`/`→`
  step between them. A build that found the code's triggers reads as done.
- Stepping in the terminal: enter on a trek opens its page, which steps it here, or in the editor
  chosen in Settings (`n` then steps here). At a stop: its file coloured by language (TypeScript,
  JavaScript, TSX, Markdown, Zig), the step's lines tinted, change signs, predicted values and
  arrows at line ends, and the narration on a band with the stop's flag in full. The title bar
  says where the stop is (`6 / 15 · api 2 of 5 · ⚠ 1 ahead`). Beside the code: the stop `n` goes
  to, how it's reached, its path or `this file`, what it says, its change and flag, and the stop
  `p` goes back to; the footer says where `n` goes, and `n` sits on a chip on the line it goes in
  from. `↑`/`↓` move a cursor, `.` goes back to the stop; `i`, `O` and `o` step into, over and
  out; `d` opens details, `D` the change to the file, enter a look at what a call leads to, `e`
  the line in the editor, and `?` every key.
- The route map, `r`: the stops as a call tree over the whole screen, `▶` and `n`, `↯` where a hop
  reached a stop and what carried it, and the functions running at `▶` named on a line over the
  tree and lit down to it. The chosen stop shows in full beside it. `←`/`→` fold a call and `n`
  and `p` step past it; `c`, `f`, and `/` narrow it to changed, flagged, or found stops; `tab`
  lays it out by repo or as a tree of the trek's files.
- Building: a stop is named as the code names it, a route for a request, and code with no name of
  its own by what fires it and where it lives (`l key in App`). A hop says what carries it
  (`via.through`: "via the agent", "on a timer"), required on every hop after the first step; saved
  treks with hops built before then load once rebuilt.
- `evals/baseline.json` holds two runs of each fixture, taken at one commit: the score, the time,
  and every number the agent reports. Each eval ends with how it compares: ✓ when it scores as
  well as the best baseline run and its time and the numbers named in `watch` fall within 15% of
  the baseline's range. `--baseline [<fixture>…]` takes it again. It replaces the hand-copied
  tables in the milestone entries below.
- The route's order counts a context step where the step it explains is.

**Next**

- Check the stepping screen and the route map in a real terminal: the lit guides, the accents on
  running stops, the chosen row's tint.
- Language support on demand: offer a missing grammar before downloading it (y, a, n, never),
  with a "Language support" setting (ask, always, never).
- The prototype's rough edges: the change view diffs the whole file; a look at a definition takes
  the first match; looks read the checked-out file, not the trek's revision.
- The build view with the draft, VS Code in the editor picker, and versions.
- Parked, as before: the change as a selectable first row with a details panel
  (`~/handoffs/home-select.html`), and adding a repo by path or URL in the picker
  (`~/handoffs/picker-add-repo.patch`).

## 2026-11-18 — The release workflow

**Done**

- `.github/workflows/release.yml`: pushing a `v<major>.<minor>.<patch>` tag runs the checks,
  builds `trek-darwin-arm64`, `trek-linux-x64` and `trek-linux-arm64` on their own runners, and
  publishes them with SHA256SUMS as the tag's GitHub release; a tag such as `v0.1.0-rc.1`
  publishes as a pre-release. A test release installed through `site/public/install` on macOS,
  and the installed `trek` runs.
- CI runs on pushes to `development` and `master` and on pull requests; a newer push cancels the
  run it replaces.

**Next**

- Try a release first as a pre-release: `git tag v0.1.0-rc.1 && git push origin v0.1.0-rc.1`,
  then `SRCTREK_VERSION=0.1.0-rc.1` with the install script. Then cut `v0.1.0`, and
  `RELEASED` in `site/src/launch.ts` turns true.
- The Linux binaries are built but not yet run from a release.
- `SRCTREK_VERSION` in `packages/core/src/protocol/messages.ts` stays `0.0.0` until versioning.

## 2026-11-17 — Milestone 7: the picker finished, the home screen, the build view

**Done**

- A review of the whole project against the coding rules: bugs, leftovers of the old name, rules
  written more than once (git helpers, range text, loading a trek, error text), each package's
  folders, and small fixes. Tests share their helpers and fixtures through `packages/testing`
  (`@srctrek/testing`).
- The step view carries its wording: where next goes, in words ("next: into refund, line 12"),
  and how the step was reached ("Reached from", "Reached by a hop from", "Explains"), which VS
  Code and Neovim print as they are.
- The change picker: while trek is open, a commit or a branch switched in any ticked repo reopens
  the change, a ticked repo on its chosen branch; a ticked repo that isn't beside this one, such
  as one trek was started with, stays listed and goes along with a pick. CODE AS IT IS offers
  finding the code's ways in (`--code`) or following a trigger the user types
  (`--code="<trigger>"`), the ticked repos going along as repos.
- The home screen says what's open: the title bar names the repo and whether it's a change or
  code as it is; the block's first line names the branch or pull request and its size, the
  other repos and their heads, those passed through, or the code and its trigger. Under it, the
  state names a saved trek by its title, says what the agent will do before one is built, and
  for code with no trigger says the ways in aren't found yet and that `b` finds them. Keys in the
  block are in the text colour, and the footer leaves out keys the block names.
- A trek of the base branch's unpushed commits reads as done (`✓ pushed`) once they're pushed;
  a change whose name a done trek holds builds under the next free name (`development-2`). With
  a change of no commits, a trek saved under its name shows its own state.
- Builds: `x` stops one, the agent and its shell as one process group, and it reads as
  `■ stopped`. `l` opens the build view: the build's state with the trek's title and a clock,
  the steps added, what the agent read, a rejected round's problems, and why it failed; `tab`
  shows the log itself, following its end. Core reads a build's log with `buildProgress`, and
  every line of a `trek mcp` report is marked `trek: `. A building symbol turns wherever it shows.

**Next**

- The build view with the draft: each step's repo and summary as it's added, which needs
  `trek mcp` to write the draft beside the build's log.
- Stepping a trek in the terminal, the route map, VS Code in the editor picker, and versions.
- Parked: the change as a selectable first row with a details panel
  (`~/handoffs/home-select.html`), and adding a repo by path or URL in the picker
  (`~/handoffs/picker-add-repo.patch`).

## 2026-11-13 — The website

**Done**

- `site/`: the landing page for srctrek.dev, static Astro with no outside requests, in dark and
  light themes: the problem, how it works, what you get, and what it is not, with share cards.
  `bun run --cwd site build` writes it to `site/dist`; CI builds it on every push.
- `site/public/install`, served at `srctrek.dev/install`: `curl -fsSL https://srctrek.dev/install | sh`
  installs `trek` to `~/.local/bin` from the latest GitHub release, checked against its
  SHA256SUMS. `SRCTREK_VERSION` pins a release, `SRCTREK_INSTALL_DIR` picks the folder. The hero
  shows the command with a Copy button.
- Deploying: a push to `master` that changes the site publishes `ghcr.io/<repo>-site:latest`, an
  nginx image serving the built site with `site/nginx.conf` (`.github/workflows/site.yml`).

**Next**

- `RELEASED` in `site/src/launch.ts` stays false until the first release is published, and the
  hero says the install is coming.
- `INDEXED` in `site/src/launch.ts` stays false, keeping the site out of search results, until
  the site is finished.
- The hero's clip: a trek stepped in the editor and the terminal, in place of the home screen's
  picture.

## 2026-11-09 — Milestone 7: the terminal

**Done**

- Step 7a: the change's trek can be built with an older guide (its prompt hash isn't today's),
  which still opens, or unreadable (a file under its name that isn't a valid trek, such as one
  from another format version), which `trek` no longer builds over unasked; the home screen
  says which, and `b` rebuilds either, showing the build as it runs.
- Step 7b: `bun packages/tui/test/capture-screens.tsx <out-dir> [screen]...` draws every screen
  and state of the terminal, from sample data in `packages/tui/test/capture/screens.tsx`, at a
  wide and a narrow size, as text with its colours and as pictures in a dark and a light
  terminal's palette, for checking each screen against `docs/DESIGN.md`.
- Step 7c: the home screen to the design, in the terminal's own colours (its default text and ANSI
  colours, so it reads on light terminals too): a title bar with the change, the repos it passes
  through, and its size (`summarizeChange`); where the change's trek stands as a block (the state
  in its colour, then dim lines on why and the keys); proposed repos, triggers, and treks under
  headings, one row each in columns sized to what they hold, treks newest first with state (known
  for the change's trek and invalid ones), steps, flags, and when each was built (left out on a
  narrow terminal); the footer's keys at the bottom. Trek entries carry when they were built and
  whether they follow code as it is.
- Step 7d: `bun packages/tui/test/capture-terminal.ts <out-prefix>`, with `--cwd`, `--size`,
  `--keys`, and trek's arguments after `--`, runs the built `trek` in a pseudo-terminal (macOS's
  `script`), presses the keys and then `q`, plays what it wrote through a headless terminal
  emulator, and saves the screen it showed as text and dark and light pictures, as Step 7b's
  capture does: the real binary and renderer, in about five seconds.
- Step 7e: the change's trek can't be opened when a local repo it names isn't where it was, or
  lacks the trek's commit; the home screen says which repo and where, enter leaves it alone, and
  the footer no longer offers enter where it does nothing. Remote repos aren't checked: they're
  fetched when the trek opens.
- Step 7f: a trek records, for each changed repo, the branch or pull request its range ended at
  (`head`), so the home screen can compare any trek with its branch now. Required: treks saved
  before it read as invalid until rebuilt.
- Step 7g: core says where any saved trek stands against its branches now (`trekState`):
  current; stale, with how many stops cite files changed since; done, its branch merged into the
  base branch or gone, or the uncommitted work it showed committed since; can't open; or
  unchecked for a remote repo or a pull request, which would need fetching. Local git only;
  about 45 ms a trek.
- Step 7h: the home screen's list in sections: proposed repos, ways into the code, this change
  (its trek, and treks whose head in every repo the change touches is the change's), other
  branches and pull requests, code as it is, then done and can't read, folded under a heading
  with a count that enter opens or closes. Every trek shows its state, loaded after the list is
  drawn; the selection follows its row by name as rows move. Trek entries carry each changed
  repo's head.
- Step 7i: the rows to the mockup: state, then the title (names leave the row), then what the
  state says beyond its word ("1 of 15 steps changed", "no worker at ../worker") or the steps,
  flags, and "built today 13:51"; the title column as wide as the longest title; proposals spread
  their source and reason past it, their keys at the end; the block says "15 steps · 3 repos"
  with the flag in red; srctrek bold in the text colour; the footer dimmed.
- Step 7k: a stale trek counts stops, as every list does (`staleStops` of `stops`, shared through
  `stopIds`), so the block and its row agree with the step counts beside them; the title bar
  writes a direct range with two dots (`main..main`), as it was given.
- Step 7j: the selected row is tinted instead of marked, as in the mockup: the home screen asks the
  terminal for its default colours and moves the background 12% toward the text, so the band
  reads in dark and light themes; a terminal that doesn't answer keeps the `▶`. The terminal
  capture now runs trek live and answers its colour queries from each palette, so it shows what
  a dark and a light terminal really get.
- States stand out more: the bright ANSI colours for states, flags, and the accent; a row's whole
  state in its colour; and stale and older guide by their own symbols (`≠`, `↻`), so they don't
  rest on telling green from yellow, which some themes draw close together.
- The states' colours are srctrek's once the terminal reports its background: a bright set on
  dark, deeper ones on light, chosen to keep green and yellow apart; text, dim text, and the
  background stay the terminal's, and a terminal that doesn't report keeps its ANSI colours.
- Crisper, closer to the mockup: the selected row's band is tinted toward the accent; content
  sits two columns from the edge; titles are cut at 50 characters, so a wide terminal keeps each
  row together; and only the trek's name is bold in the block.
- The editor treks open in is picked in the terminal: enter before one is chosen opens a picker
  of the editors found here (Neovim; `$EDITOR`, at the trek's first stop without stepping), the
  choice is kept per user in `$XDG_CONFIG_HOME/srctrek/settings.json` (else `~/.config`), written
  in place and keeping keys it doesn't know, and `E` picks again; the footer names it. VS Code and
  its forks join the list once the extension can take a trek from outside.
- Settings on `S`: the editor (its picker), the agent's command, building automatically, and
  colours, each with its value (and a note when `SRCTREK_AGENT` sets the agent); enter changes the editor, building, and
  colours. The agent's command comes from the settings file or `SRCTREK_AGENT`, which overrides
  it (`agentSetting`), in `trek` and `trek serve` alike. Building automatically is off by default,
  so `trek` builds on its own only when asked; colours switches the states to the terminal's own.
- The agent's command is set in settings: enter on Agent opens a field with the command in the
  file, and saving runs it once with a tiny instruction (`packages/core/prompts/agent_check.md`,
  outside the prompt hash), showing "the command starts and answers" or what it printed last.
  The no-agent state points to settings. The location prompt and this field share `TextPrompt`.
- An agent sets srctrek up from its chat: `set_agent_command` (in `trek mcp`) runs the command
  it's given once, saves it to the user's settings if it starts and answers, and else says what
  failed so the agent can fix it. Its description and answers are prompt files outside the
  prompt hash; settings' help for the agent points to it.
- From settings to the agent's chat in one key: `c` on Agent copies the request
  (`packages/core/prompts/setup_request.md`) through the terminal's clipboard, or shows it to copy
  by hand where the terminal can't take it; the home screen rereads the settings file every two
  seconds, so the agent's save shows up, with "your agent saved its command". Each row's footer
  says what enter does to it.
- Setup is findable: the README gives the MCP config for `trek mcp` and the home screen's
  current keys, and the setup request has an agent without srctrek's tools tell the user how to
  register it.
- Secondary text is readable in any theme: once the terminal reports its colours, it's mixed 60%
  from the terminal's background to its text (`tonesFor`), instead of the theme's ANSI 8; every
  grey on screen comes from the tones now.
- The request to paste is on screen: on Agent, while no command is set and right after `c`, it's
  quoted under the help with an accent bar, in plainer words that say what the setup is for and
  that srctrek tests the command; once the agent has saved its command, it goes. The settings
  path in the title bar shows home as `~` and is cut from the left to fit.
- Settings to the design: grouped under OPENING, BUILDING, and LOOK like the home screen's
  sections, the chosen row on the home screen's tint, building shown as `● on` or `○ off`, the
  colours with a sample of the states in them, the agent's command marked `✓` or `✕` once checked
  on this visit, and the help in a panel above the footer, under the setting's name. Without a command or value, it reads in
  grey.
- The title bar leads with what's reviewed, the branch or pull request (each repo's where they
  differ), with the repos and how many commits since the base on the right, which gives way
  first on a narrow terminal. Repos are named after their project's folder, so a worktree reads
  as its project, not its own folder.
- `trek` follows the worktree while open: every two seconds it checks `worktreeStamp` (the
  checked-out branch and commit, and each saved trek's file time) and the agent in the
  settings, and when either moves it works the change out again (`openChange` in the CLI), so a
  commit, a branch switch, a trek saved elsewhere, or an agent just set shows without a restart.
- The change can be chosen on screen: `C` opens a picker with the user's own branch first (with or
  without work not yet committed) and the repo's other branches (`branchChoices`), each saying
  what it opens and where its trek stands (`choiceStatus`, filled in as each is worked out); a pick becomes trek's arguments (`choiceArguments`), so following the worktree
  reopens it, and the title bar marks it `· picked`. Its open pull requests follow, listed
  through the user's own `gh` (`openPullRequests`), those waiting on their review first, without
  a trek state (that would mean fetching each); when `gh` can't list them, its own words say why.
  While a pick is worked out the home screen says `◐ opening pr 12…`, and when it can't be, why,
  in git's last words (`failureReason`), until the next pick. Under MORE REPOS, the repos beside
  this one with work on them (`nearbyCheckouts`), the rest folded under a count; `space` ticks
  one to go with the change, changed on what it has checked out or passed through when that's
  its default branch, and enter on a repo opens the current change with them. `→` on a repo opens
  its branches under its row (`repoBranches`): the few latest and the one checked out, each with
  when, who, and what about, the rest under a count, its default branch to pass it through, and a
  line that fetches it (`fetchRepo`); typing narrows them, and enter takes one.
  Following ticked repos, adding a repo by path, and code as it is come next.

## 2026-11-03 — Milestone 6: the editors

**Done**

- Step 6a: next and prev pass over context steps, which the step they explain offers; a step's
  number counts the executed steps, and a context step takes the number of the step it explains.
  Readers see stop numbers, never step ids; the guide numbers executed steps without gaps and
  gives a context step its step's id plus a letter (`s8a`).
- Step 6b: a step can carry a `name`, the function, route, or handler it shows, and the view
  passes it on, so the call stack and the route list `createRefund`, not a sentence; the guide
  asks for it. Treks without names still load.
- The evals count a bug line in a context step as flagged by the step it explains, which the reader
  opens it from; the expire trek that flagged `daysAgo` for `DAY_MS` now scores the bug found.
- Step 6c: what the editors will need from the terminal's code, moved into core: the saved treks
  with their summaries (`loadTrekEntries`), building or updating the change's trek
  (`buildChangeTrek`), and reading `SRCTREK_AGENT` (`agentCommand`). Behaviour unchanged.
- Step 6d: `trek serve` answers `treks` (the saved treks and the change's status), `build`
  (builds or updates the change's trek; error 7 without an agent), and `log`; an unreadable
  change is error 8. The trek list counts stops, as stepping does.
- Step 6e: the Neovim plugin on `trek serve`: `:Trek <name>` starts it and opens the trek,
  every move is a request, and the plugin draws the view it gets to the visual language (stop
  number and call stack in the winbar, `≈` values, the high flag under the narration, stale
  steps, a count of context steps). Step over is on `<leader>tn`. Its stepping logic and trek
  reading are gone. Headless Neovim tests drive it against the real server; they're skipped
  where `nvim` isn't installed, as in CI. The terminal opens a trek in Neovim by name, with its
  own `trek serve`.
- Step 6f: a line that makes a call the trek follows ends in `→` (`↯ api` for a hop into another
  repo), from the line the entered step's evidence cites, and step into takes the call on the
  cursor's line, else the first not yet visited. This replaces the into picker. A call citing
  no line of the step is listed under the code.
- The Neovim plugin leaves the user's setup alone: the window's own winbar comes back off a step
  and on quit, and a move closes only the plugin's own popups, not another plugin's float.
- Knowing where the trek is, in Neovim: the step has a tint of its own (`ColorColumn`, not the
  cursor line's), `▶` on its first line, the winbar says `away` once the
  cursor leaves the step, and `<leader>tc` (`:TrekCurrent`) goes back without moving the trek.
- Knowing you're in a trek, in Neovim: a `srctrek` badge starts the winbar; the narration sits on a band across the window. The step's tint, the band, and
  the badge are mixed from the theme's text, background, and info colours, checked across
  Neovim's built-in themes, dark and light: no theme group is distinct in all of them.
- Reading a step, in Neovim: the stop number is the winbar's strongest text; a file the change
  adds whole gets a "new file" tag instead of a `+` on every line; the step opens near the top
  without scrolling past a short file's end; the band has a `▌` edge, and stays distinct from
  the tint on light themes. `scripts/nvim-screen.lua` captures the plugin's screen as text and a
  picture, for checking a change across colour schemes.
- A trek loses nothing of the user's: the tab it had is gone, and each window it draws in gets
  back its file, cursor, and scroll on quit. A buffer it replaces stays loaded while the trek
  runs, so with 'hidden' off its unsaved changes and undo history survive and the step still
  opens.
- A step opens the user's own file when its content is the trek's version, decided per file, so
  a branch that moved on since keeps opening the user's files; a file that differs opens from
  the trek's copy in the cache, read-only, with "trek's version" in the winbar. The copy is
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
- The end of a trek lists every flag, most severe first, each with its stop and place; enter on
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
/refunds`, `next: back to createRefund`, or `next: the end of the trek`, and the arrow on the
  line next enters from is bold. The view carries `next`.
- Predicted values read `name ≈ value` (`returns ≈ 250`, `name ≈? value` when doubtful), each
  cut at about 40 characters; details show them whole in the same form.
- The trek's arrows and values come first at a line's end, before diagnostics and other plugins'
  text, which Neovim draws in order of priority.
- A trek's read-only copy opens with its diagnostics hidden until the trek ends; the user's own
  files keep theirs.
- Step 6g: the VS Code extension's skeleton, in `editors/vscode` (in the workspaces, under `bun run
check`): "srctrek: Open Trek…" lists the treks in a quick pick, `Alt+]` and `Alt+[` step, each
  step opens its file with its lines tinted, and the status bar shows the stop. Its client for
  `trek serve` has no VS Code API in it and is tested against the real server; the extension
  bundles none of core's code. The VS Code layer's checks run inside the installed VS Code, with a
  profile of their own, through `bun editors/vscode/test/run-in-vscode.ts`, run by hand on a
  machine with a desktop session.
- The VS Code extension shows each stop's narration in full, wrapped, in a read-only comment
  thread above the step (the line before it; below the first line on a file's first line), with
  "srctrek" and "stop N of M" in its header. Next and previous moved to `F8` and `Shift+F8`, only
  while no debug session runs.
- VS Code steps over, into, and out on `F10`, `F11`, and `Shift+F11`; into takes the call on the
  cursor's line, else the first not visited. Each line making a call ends in `→` (`→?` guessed,
  `↯ repo` into another repo), bold on the line next enters from, and a move with nowhere to go
  says so in the status bar and leaves the cursor.
- `bun editors/vscode/test/capture-vscode.ts <trek> <out-dir>` steps a saved trek in the installed
  VS Code, maximized in a profile of its own, and saves a PNG of VS Code's window at the overview,
  each stop, and the end. Run by hand on a machine with a desktop session; macOS asks once for the
  terminal's Screen Recording permission. The extension's commands answer with the view they leave
  the trek on.
- The VS Code narration panel wraps; carries a high flag under the narration, a risky or
  worth-knowing flag and where next goes after it, and the step's tags in its header (existing code
  or new file, guessed link, context available, trek's version, stale). A trek's copy of a file
  opens read-only for the session.
- VS Code shows predicted values at the ends of their lines, `name ≈ value` in the inlay-hint colour
  and `≈?` in the warning colour, cut at 40 characters; "srctrek: Show or Hide Values" toggles
  them.
- VS Code's overview and end open in a trek tab (a webview in the theme's colours, its own script
  only): the overview has the story, trigger, outcome, repos, flag counts, and the keys; the end has
  the outcome and every flag, each a link that goes to its stop through `goto`. Stepping onto a
  stop closes the tab.
- VS Code's sidebar, in the Explorer: srctrek's Treks view lists the saved treks (from a `trek serve`
  started for the listing; refresh in its title bar), each opening on a click; srctrek Stop, a
  webview, shows the stop's call stack newest first (hops `↯`, "started by"), where it came from
  with each cited line's code (a link opens it; "guessed" when it is), the flag, values, details,
  context steps, and questions, each stop a link. The route (every stop in order) isn't in the
  protocol's views, so the sidebar doesn't list it.
- The two views moved from the Explorer, where they sat collapsed under the files, to srctrek's own
  sidebar in the activity bar (`editors/vscode/media/trek.svg`), Treks above a taller Stop; opening a trek opens
  the sidebar on the stop.
- VS Code: "srctrek: Show Context" opens the stop's context code in VS Code's peek view over the
  step; "srctrek: Show Current Stop" goes back to the stop; `Escape` in the end tab ends the trek.
- `bun run --cwd editors/vscode package` builds srctrek.vsix in the extension's dist with
  `@vscode/vsce`: the bundled extension, its manifest, and its icon, nothing else
  (`.vscodeignore`). It's packaged without a license or repository field, as the repo has neither
  yet; `@vscode/vsce-sign`'s postinstall, for signing a published extension, stays blocked.
- VS Code's narration moved from the comment-thread panel above the step, whose frame VS Code fixes,
  to the top of the Stop view, with the flag and where next goes; the Comments view no longer opens.
  The line above the step holds a CodeLens row: `srctrek 2/5` and the flag open the Stop view,
  `context` opens the context code, `next: … ▸` steps on. The step's tags moved to the status bar.
  The Stop view is blocks split by a rule: the narration with its details, flag, and where next
  goes; then the call stack (only with two frames or a "started by"), came from with each cited
  line's code, context, and questions, under small uppercase labels. It leaves out what the status
  bar, the actions, or the code already show: the stop number and the values.
- `bun scripts/showcase-repo.ts` makes a throwaway repo and prints its path; its trek "pay" uses
  everything an editor shows: values of each role, a doubtful one, a flag of each severity, a stop
  with two calls, a guessed link, context, a question, and a hop that starts a stack of its own.
  Open it in an editor, or pass it to the VS Code capture as its workspace.
- VS Code marks the lines the change adds or edits with a bar in the gutter beside the line numbers,
  where VS Code's diff bars sit, and a mark on the scrollbar; the gutter icons come light and dark
  in VS Code's default diff colours, as an icon can't take a theme colour; a file the change adds
  whole gets none, its "new file" tag says it. In the showcase, the change edits the payments file rather than adding it. The overview tab
  says once, under "On screen", what the bars, `≈`, `→`, and the actions above a stop mean, each
  beside a sample of how it looks.
- VS Code's context code moved from VS Code's peek view, which an extension can't style and which
  read like more of the same file, into the Stop view: under CONTEXT, each piece's reason, its
  place (a link to it in the trek), and its code in a framed block, cut at 8 lines with a link to
  the rest ("… 37 more lines"), so a large contract stays small. Show Context and `context` above
  the step scroll the Stop view there.
- The prototype's asking (`<leader>ta`) is gone: its prompt was written in the plugin, not in
  `packages/core/prompts/`. Asking comes back later through `trek serve`.
- A guessed link shows where it's met: "guessed link" in the winbar of the step it reaches, `→?`
  on the line it was guessed from.
- The winbar: the stop number and its tags, then the place as `repo: path`, the repo in its own
  colour, then the stack, its frames below the step's dimmed, split by a dim `│`; "away" at the
  right end.
- A crisper flow, from a walk through every screen: quitting a fresh Neovim leaves its window
  empty again (Neovim had reused the start buffer for the trek's first file); opening says so at
  once and binds the keys, so a key pressed meanwhile no longer runs Neovim's own `]t`
  (`:tnext`); a move with nowhere to go says so and leaves the cursor; the overview lists the
  repos, flag counts, and the keys; floats fit their text; nothing sits under the step's code any
  more.

## 2026-11-03 — Milestone 5: design pass

**Done**

- Step 5a: the flows, in `docs/DESIGN.md`: reviewing a pull request or work in progress, learning
  unfamiliar code, coming back to a stale trek, building from the agent's chat, asking, stepping
  without a plugin, and what happens when it doesn't work. A session starts from the terminal
  (enter opens the editor `SRCTREK_EDITOR` names) or from the editor (which lists, opens, and
  builds treks).
- Step 5b: the visual language, in `docs/DESIGN.md` and a review page: each role's look, wording,
  and the theme colour it follows in Neovim and VS Code; the call stack newest frame first; context
  steps opened from the step they explain, not visited by next.
- Step 5c: the editor screens, in `docs/DESIGN.md` and a review page: choosing a trek, the
  overview, a step, details, stepping into one of several calls, the end, and asking, in Neovim
  (no sidebar, floats) and VS Code (CodeLens and a sidebar); VS Code steps with the debugger's
  keys.
- Step 5d: the terminal screens, in `docs/DESIGN.md` and a review page: the home screen and every
  state of a change's trek, the build view, the route map in lanes per repo, and stepping in the
  terminal for anyone, not only editors without a plugin.
- Step 5f: OpenTUI kept for the terminal, judged against the designed screens and an Ink build of
  the route map (Ink adds about 1 MB against OpenTUI's 14 MB, but the screens need nothing it
  does better). The GUI's design waits until beta testers ask for one. OpenTUI upgraded from
  0.6.6 to 0.8.1, with no changes to our code.

**Closed 2026-11-03.** `docs/DESIGN.md` says how every surface looks and behaves: the flows, one
visual language that follows the editor's theme, the editor screens in Neovim and VS Code, and the
terminal screens, each reviewed as a mockup. The terminal keeps OpenTUI, kept up to date until 1.0.

**Walking an agent-built trek (refund eval, 2026-11-04)**

Stepping it with `]t` alone, the reader couldn't tell what happened or what each step does. The
guide's narration was rewritten first; on a second walk the story connected from stop to stop,
background code came with its reason, and the queue hop was cited (refund eval: route 10/10, both
links cited, bug flagged high, stacks 4/4, 39 turns). The guide items below are done; the screen
follows, one small step each.

From the second walk:

- The trek's title is long and repeats the route: the guide now asks for a few words; to check on
  the next walk.
- Details' "came from" listed places without what they show: done, below.
- A contract a step crosses or implements (a spec entry, a schema, a message's type) is often the
  key fact at a boundary: in the refund trek, the spec says amounts are in minor units and web
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

The trek format:

- A guessed link carries what was assumed and how to check it.
- Context steps stay, or become a "see also" list with a reason each: still to decide.

The screen:

- The band says where `]t` goes next: done, below.
- A hop nobody waits on (a queue, an event) starts a fresh stack, and the stack names the repo at
  a hop: done, below.
- "unchanged" says that the step is existing code the flow passes through.
- Values read `name ≈ value`: done, below.
- The trek's marks come before diagnostics at a line's end: done, below.
- Diagnostics are hidden in the trek's read-only copies: done, below.
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
  treks, and asking (`trek ask`, answers through MCP, notes on steps, branch treks for what-if
  questions).
- 7: the TUI to `docs/DESIGN.md`: home screen (with version, stale, and unreachable states, and
  treks built with an older guide, whose prompt hash differs from the current one), build
  view, route map, and stepping view. `trek` and `trek mcp` report the commit
  they were built from instead of version 0.0.0, and treks record it.
- 8: the beta: `trek` for testers without a checkout, shipped with the .vsix package; a clear
  error when an editor can't start `trek serve` (VS Code started from the Dock doesn't see the
  shell's PATH), and `trek --help`; a one-page tester guide in `docs/`; a list of known rough
  edges and a feedback channel.
- 9: a GUI sharing screens with the VS Code extension, if beta testers want it.

**Version 1 scope:** see `DECISIONS.md`; deferred work in `docs/ROADMAP.md`.

**Open**

- The overview float, later: `1 stops` reads `1 stop`; repos and flags show only when there's
  something to say; wrapped trigger and outcome lines hang under their text; one line of keys
  (`]t next · [t back · <leader>tt details · ? keys`) with the full list behind `?`. Check how
  long the agent's overviews run in the evals, and whether the prompt needs a limit.
- Check the name before going public.
- A build can't be stopped once it's started: not from the home screen, `trek serve`, or the
  editors. For Milestone 8's rough-edges list, or a key on a building trek.
- Stop ignoring the .srctrek folder once treks are written with portable sources; clear
  out local-only files (demo treks) first.
- OpenTUI stays, kept up to date with each release until 1.0; it's at 0.8.1.
  Revisit if an upgrade costs more than a day or a target platform fails to load it.
- A context step's `for` names one step, so a context step can't explain several.
- Over and out count a hop as inside its caller only when a return comes back across it: in a
  trek that never shows a request's response, over from the caller stops inside the handler.
- One function reached from two callers: a step names one `from`, so the second caller has
  no step to step into.
- The refund trek's s3 (web's `renderOrder`) comes from the api's handler (s2), so its stack
  says the api calls it.
- Progress from trek serve: a first open of a remote trek (clone, fetch, worktree) and asking
  take seconds to a minute in silence. Add a progress notification with asking in Milestone 6.
- Large repos: editor worktrees should check out only the files a trek visits (sparse
  checkout), with the editors in Milestone 6.
- Token use: most of it is the context re-read every turn as it grows, so turns matter more
  than answer sizes; the build log's per-read lines show where they go. Runs vary, so compare
  guide versions over several runs.
- Proposed repos: a sibling is read on the work's branch only when it has one of the same name
  (locally or remote-tracking); otherwise at its default branch, with the hop flagged.
- Headless builds search the code host or read pull request descriptions only when the
  agent command in `SRCTREK_AGENT` allows read-only host tools.
- Nearby repos: only the folder around the current repo is scanned, not nested layouts such
  as `~/git/org/repo` across organisations.
- An updated trek keeps a step whose own files are unchanged, which can still be wrong when
  code it calls changed.
- Accepting a proposal whose source pins a branch (`<url>@feature`) pins the repos list to it.
- WSL not yet tested.
- `bun test` would collect `*.test.ts` files inside eval fixtures.
- `tsconfig.json` covers only `packages/*/src`, `packages/*/test`, and `scripts`; code under
  `evals/` is not typechecked or type-aware linted.

## 2026-10-30 — Milestone 4: `trek serve`

**Done**

- Step 4a: context steps name the step they explain (`for`) in place of `from`, citing both
  repos when the two differ, and execution never comes from or steps into one; `calls` lists
  the steps a step steps into, in call order. The Neovim prototype steps into the first.
- Step 4b: call stacks worked out from the links (`callStacks`), with a return that comes back
  to no frame rejected and `from` always naming an earlier step; `calls` removed. The guide
  says code that runs later in response to something is a hop. The refund trek's split
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
- Step 4f: the view's context from git (`viewContext`): each repo checked out at the trek's
  revision, the lines its range touches, and stale steps given the change as it is now (the
  trek records commits, not branches, so the caller supplies the change). A missing repo or
  commit is an `UnreachableRepoError` naming it.
- Step 4g: the protocol's messages in core (`RequestParams`, `ErrorCode`, `PROTOCOL_VERSION`,
  `SRCTREK_VERSION`): requests answer with the view; open takes a trek by name and, for stale
  steps, trek's arguments. `docs/PROTOCOL.md` describes version 1: stepping.
- Step 4h: `trek serve` (`packages/serve/`): JSON-RPC over stdio through `vscode-jsonrpc`, the
  handshake, and each request carried out on the stepping session in order, answered with its
  view; failed requests leave the state as it was.
- Step 4i: contract tests for `trek serve`: a JSON-RPC client drives the real process through
  the handshake, a whole trek, into, over, out, errors, stale steps, and requests sent together
  behind a slow open, answered in order.

**Closed 2026-11-03.** Editors step through a trek by talking to `trek serve`: core holds the
stepping session (next, prev, into, over, out, goto) over call stacks worked out from the
trek's links, and answers each request with a view ready to render. Evals score the stacks
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

## 2026-10-27 — Milestone 3: trek building

**Done**

- Step 3a: the read tools in core (`packages/core/src/read/`), each on a repo of the
  resolved change at its revision, through git objects only: listing files, reading
  numbered lines, searching with a regular expression (capped at 200 matches), and the
  change's files and a file's patch.
- Step 3b: `trek mcp`, an MCP server over stdio (`packages/mcp/`, on
  `@modelcontextprotocol/server`): `open_change` with `trek`'s arguments, then
  `list_files`, `read_file`, `search`, and `diff`. Tool descriptions are prompt files in
  `packages/core/prompts/tools/`. "mcp" as `trek`'s first word is the command: a
  folder by that name is given as `./mcp`, a branch as part of a range (`main...mcp`).
- Step 3c: predicted values on their lines in the trek format (`{ name, value, line, role,
uncertain? }`, each inside its step's lines), the refund fixture's values placed on their
  lines, and the Neovim plugin drawing them from `predicted_values`, doubtful ones in the
  warning colour.
- Step 3d: a submitted step completed and checked (`packages/core/src/build/`): core adds the
  file's blob and whether the change touches the step's lines, and lists every line the step
  relies on (its range, each citation) that doesn't exist at its repo's revision.
- Step 3e: building a trek over `trek mcp`: `start_trek`, `add_steps` (checked, all or none;
  a step sent again by id replaces it), and `finish_trek` (the whole-trek rules, then saved to
  .srctrek/treks with its changed-lines file). The tool prompts carry the step fields and
  the rules for predicted values.
- Step 3f: `--uncommitted`, for `trek` and `open_change`: each local range ending at HEAD
  ends at a snapshot of the working tree (a commit on top of HEAD under refs/srctrek,
  made with a temporary index), so treks of work in progress cite exact commits too.
- Step 3g: the `build_trek` MCP prompt (`packages/core/prompts/build_trek/`): how to choose
  a scenario, follow it in execution order, link steps with evidence, show its values, and
  flag only what matters; its `change` argument fills in `open_change`'s args. The same
  guide is the `trek_guide` tool, and the server's instructions say to read it first, so
  asking for a trek in plain words works. `trek mcp` started from a terminal says it's
  waiting for a client.
- Step 3h: whether a change already has a trek (a saved trek with every changed repo at the
  same commits), and a name for a new one from its heads: the branch (`feature-refunds`), a
  pull request (`pr-12`), or the branch with `-uncommitted` for a snapshot.
- Step 3i: background builds (`startBuild`, `buildState`): `$SRCTREK_AGENT` runs detached
  with the headless instruction as its last argument; its log and exit code go to the git
  folder (.git/srctrek/builds). `trek mcp` stops a build at its third rejected round.
- Step 3j: a change's trek status (`trekStatus`): ready, building, failed (with the end of
  the build's log), or missing. Snapshots became stable: dated with HEAD's date and leaving
  .srctrek as HEAD has it, so a trek of uncommitted work is found again.
- Step 3k: `trek` builds the change's trek when it has none and `SRCTREK_AGENT` is set;
  the home screen shows where it stands (building, failed with the end of its log and `b` to
  build again, how to set `SRCTREK_AGENT`, or nothing to trek when the change has no
  commits) and picks out the trek once it's saved.
- Step 3l: citation checks catch lines off by one: a step's first and last line, each
  citation, and each predicted value's line must not be blank.
- Step 3m: `--code[="trigger"]` for treks of code as it is: repos only, local ones at HEAD
  (or a snapshot with `--uncommitted`) unless pinned, the trigger kept on the resolved
  change. Status, naming, and building for them come next.
- Step 3n: `trek --code` builds treks of code as it is: the guide opens for code (with the
  trigger the user named, or one the agent picks) and shares its method with change treks;
  code treks are named after the trigger or `<repo>-code` and found again only while their
  repos are at the same revisions.
- Step 3o: watching a build: `trek mcp` appends each answer it gives the agent to the
  build's log as a `trek:` line; the home screen shows the log's end while building and `l`
  opens it all. Reading a build's state no longer creates its folder. A build that saved its
  trek, whose trek was then removed, reads as missing, so the trek is built again.
- Step 3p: plain `--code` finds triggers instead of building a trek: the agent records them
  with `record_triggers` (kind, a name in the user's words, a cited line, checked like any
  citation), they're saved in .srctrek/triggers tied to the revisions, and the home screen
  lists them with the command that treks each.
- Step 3q: the found triggers are rows on the home screen: each says whether its trek is
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
  builds a fixture's repos, has `SRCTREK_AGENT` build the trek of the change in
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
  line merely inside a step was met by every route-following trek); the report also counts
  flagged steps by severity. All four fixtures scored perfect under the old check. A fixture
  lists every line where its bug can fairly be flagged, and can mark a route entry optional
  (plumbing, or evidence the links check already scores); skipping one isn't a miss.
- Step 3y: `propose_repo`: the agent proposes a repo the route leads into, with a name, a
  source, a reason, and cited evidence; it's recorded in proposed-repos.json under .srctrek,
  and only the user adds it to the repos list (`acceptProposal`) or dismisses it. The guide
  ends a hop at the boundary and proposes the repo.
- Step 3z: proposed repos are the first rows on the home screen, with source and reason;
  enter adds one to the repos list, d dismisses it. A trek already built doesn't take the new
  repo until it's rebuilt.
- Step 3aa: finding where a proposed repo lives: `open_change` names git repos next to the
  current one that aren't opened (other worktrees of the same repo left out); the agent looks
  there first, then on the code host with its own tools. When it finds nothing it proposes
  without a source, and enter on that row asks the user for a path or URL.
- Step 3ab: a proposed repo with a source is opened in the same build (at its default branch,
  its path relative to the current repo), so the trek goes on into it and records it; only
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
  the last fetch, and the agent is told to say so in the trek.
- Step 3af: `--reviewer` for the eval runner: a fixture's repos built as clones of stand-in
  hosts, the work only on `origin/feature`.
- Step 3ag: fixture `checkout`: the service the shop calls `payments` lives in a folder named
  `pay-backend`, beside a decoy `api` with similar routes and its own `feature` branch; the
  planted bug is a field name that differs between the two sides. Runs start in `shop` alone.
  Repos are scored by the folder they were read from, and decoys stepped into are reported.
- Step 3ah: stale treks: a trek saved under the change's name at commits the change has moved
  on from is `stale`, counting the steps whose files changed since; the home screen says so,
  and `trek` no longer rebuilds it on its own.
- Step 3ai: updating a stale trek: `b` starts a build told to update it. `update_trek` carries
  over the steps whose files and cited files are unchanged, at the new commits, and lists the
  rest with why; redone steps go back to their places, and `finish_trek` takes a revised title,
  overview, or outcome. A step whose own files are unchanged can still be wrong when code it
  calls changed; the agent is told to look over steps next to the ones it redid.
- Step 3aj: `--update` for the eval runner: build, commit the fixture's follow-ups, update, and
  report both runs; `refund` has one (an error message changed in place in api's handler).
  First run: the update took about 385k input tokens and 45 s against the build's 433k and 98 s,
  14 steps carried over and 3 redone, the trek still fully correct.
- Step 3ak: the build log gets a line for every read and for the guide, with the answer's size:
  `trek: read_file api src/pay.ts 1–40 → 1210 chars`.
- Step 3al: `update_trek` answers with the whole trek, one line per step marked keep or redo
  (with why and what it said before), and asks the agent to read only what the redone steps
  need. The logs had shown an update re-reading every file of all three repos to redo three
  steps. On refund: about 256k input and 3k output tokens in 37 s, against the build's 610k and
  14k in 135 s; updates before took 370–385k input tokens.

**Closed 2026-10-29.** Treks are built through `trek mcp` by the user's agent, in chat or
headless; the agent proposes repos the route leads into and the trek goes on into them; stale
treks are marked and updated; evals score quality and measure token use.

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

## 2026-10-26 — Milestone 2: git, repos, and the `trek` command

**Done**

- Step 2a: each step names where execution came from (`from`), and a link from another
  repo must cite both repos or be marked guessed. Validation messages name the step id.
- Step 2b: reading a range (`main...feature`, `main..feature`, or a head alone) and resolving
  it to exact commits, detecting the base branch when none is given
  (`packages/core/src/git/`).
- Step 2c: reading a file and its blob id at a commit, the files that changed between two
  commits, and a file's changed lines numbered as in the new version.
- Step 2d: eval fixtures built into real git repos (`main` and `feature` branches) for tests;
  the refund trek is checked against them: blob ids match and every cited line exists.
- Step 2e: repos without changes, read from `.srctrek/repos` (one `path[@revision]` per
  line, `#` comments allowed) and resolved to an exact commit at the default branch or the
  pinned revision (`packages/core/src/repos/`).
- Step 2f: a repos-list line can name its repo (`payments = ../payments-service`), and a
  repo is found by the name the code calls it. Proposing repos while building
  (`propose_repo`) is part of Milestone 3.
- Step 2g: a pull request URL read as a clone URL plus the ref its head is fetched from, by
  the URL's shape (GitHub's `/pull/<n>`, GitLab's `/-/merge_requests/<n>`), so
  self-hosted instances work too.
- Step 2h: remote repos cached as partial bare clones under `$XDG_CACHE_HOME/srctrek`
  (else `~/.cache/srctrek`), one per host and path; fetching updates branches and pull
  request refs. Git never prompts for a password; logins come from the user's git setup.
- Step 2i: a pull request resolves through the cache to its repo and range (branch point on
  the host's default branch to the pull request's head); repos-list URLs resolve through the
  cache too, at the default branch or a pinned revision.
- Step 2j: the folder the editor opens for a repo at a commit: the user's own checkout when
  it's there unedited, else a worktree under the cache, detached at the commit.
- Step 2k: `trek`'s arguments read into changes (ranges, pull requests) and repos on the
  route (`packages/core/src/change/`), with errors for paths that aren't there, ranges
  without a repo, and pull requests git can't fetch.
- Step 2l: a whole change resolved to every repo at an exact commit: the changes (local or
  remote ranges, pull requests), then repos given without a range, then the current repo's
  repos list; each repo kept once, names unique.
- Step 2m: the `cli` package, `trek`'s entry point (`packages/cli/src/main.ts`): reads the
  arguments, resolves the change, says what's wrong with arguments it can't use, then opens
  the home screen. Nothing uses the resolved change until Milestone 3.

## 2026-10-23 — Trek schema and an interim home screen

**Done**

- Milestone 2, step 1: the trek schema (`packages/core/src/schema/trek.ts`) and saving,
  loading, and listing treks (`packages/core/src/treks/store.ts`).
- The spike's Neovim plugin moved into `editors/nvim/` as a prototype.
- An interim TUI home screen, listing the .srctrek/treks folder and opening a trek in
  Neovim; started by `trek` since step 2m.

## 2026-10-22 — Quality spike

**Done**

- Fixture `evals/fixtures/refund/`: a refund feature across a TypeScript web client, a
  TypeScript API, and a Python worker, with a planted units bug; ground truth in
  `evals/fixtures/refund/expected.json`.
- A reviewer agent, given only the three repos, built a 20-step trek: every ground-truth
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
