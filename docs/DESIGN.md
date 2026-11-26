# Design

How every surface looks and behaves. Milestone 6 builds the editors from it, Milestone 7 the
terminal. Status: Milestone 5, in progress.

## Surfaces

- **Terminal** (`trek`): choosing a change, watching its trek being built, the whole route at
  once, and stepping through a trek.
- **Editor** (the Neovim plugin, the VS Code extension): stepping through a trek in the editor.
  Stepping is as good in either, from the same step view; which to use is the user's.
- **The agent's chat:** building a trek by asking for one.
- **GUI** (later): screens shared with the VS Code extension.

## Flows

### 1. Review a pull request

1. In a repo of the change, run `trek <pull request URL>…`, or `trek` and choose the pull request
   or branch on the landing page.
2. `trek` resolves the change, fetching what's remote, and opens its screen. `b` builds its trek,
   and the screen follows the build: its steps as they arrive.
3. A repo the agent proposes shows under the build: `y` adds it to the repos list, `x` dismisses
   it. The trek goes on into it either way.
4. Once saved, the screen shows the trek's overview, and enter steps it, in the terminal or the
   chosen editor.
5. In the editor: the overview, then next, over, into, and out through the steps, high flags
   inline and predicted values at the ends of their lines; at the end, the outcome.

### 2. Review work in progress

`trek --uncommitted`: as in flow 1, on a snapshot of the working tree, for one's own work or an
agent's.

### 3. Learn unfamiliar code

1. Code as it is, from the landing page or `trek --code`, finds the code's ways in (routes,
   commands, jobs, handlers) with `b`, each listed with the line that proves it and its trek's
   state.
2. `b` builds the selected one's trek, and enter steps it once built; `B` finds the ways in again.
   The last row follows a trigger the user names; `trek --code="<trigger>"` opens that trigger's
   trek on its screen.

### 4. Come back after the change moved on

The change's screen marks the trek stale, with how many steps' files changed; `b` updates it. Until
then the editor marks the stale steps. A trek of code as it is stays current while the code moves
on without touching a step's file.

### 5. Build from the agent's chat

The user asks their agent for a trek in plain words; the agent builds it through `trek mcp`, and
`trek` shows it on the change's screen, and on the change's row of the landing page.

### 6. Ask about a step (Milestone 6)

On a step in the editor: ask a question, see progress while the agent works, read the answer
beside the code with citations to jump to. The answer is saved on the step as a note.

### 7. Step without an editor plugin

From a change's screen, the stepping view in the terminal; `e` opens the step in the user's
editor at its line.

### 8. When it doesn't work

- No agent configured: the change's screen says to set one in settings, or to ask the agent for a
  trek in its chat.
- A build failed: the end of its log, `b` to build again, `l` for its builds and their logs.
- A repo isn't reachable: its name and where it was expected.
- A trek from another format version: says so, with a rebuild.
- A change with no commits: nothing to trek.

### Where a session starts

- **From the terminal:** `trek` opens the landing page; with arguments, the change they name, on
  its screen. Enter on a change opens its screen: the change, its trek's state, and, once there's
  a trek, its overview. Enter there steps it where the user's Step in setting says: the terminal,
  the default, or an editor found on the machine that can open a trek (Neovim, and `$EDITOR` at
  the first stop without stepping); the other place is one key away, `e` for the editor or `n`
  for the terminal. The choice is kept per user, in `$XDG_CONFIG_HOME/srctrek/settings.json`
  (else `~/.config`); settings changes it.
- **From the editor:** the plugin or extension lists the saved treks with their status (ready,
  stale, building, failed), opens one, and starts a build. The protocol gains the requests for
  this in Milestone 6.

### Open

- **Terminal and editor together:** the route map following the editor's step needs several
  clients on one session (`docs/ROADMAP.md`).

## Visual language

The vocabulary every surface shares, shown in place on a step in the review page for Step 5b.

### Principles

- **The editor's theme wins.** Each role is named (`SrctrekFlagHigh` in Neovim,
  `srctrek.flagHigh` in VS Code) and defaults to a colour the theme already defines; users
  override a role without changing their theme. Text at a line's end or in the gutter takes
  only the theme colour's foreground. No theme group is distinct from the background in every
  theme, so the step's tint, the narration's band, and the badge are mixed from the theme's
  text, background, and info colours.
- **The user's own files, where they can be.** A step opens the user's own file when it's the
  version the trek describes; only a file that differs opens from the trek's copy, read-only.
- **Nothing the user has is lost.** A trek changes no file, buffer, window, key, or setting of the
  user's for good: whatever it borrows (a window, a key, the winbar) comes back as it was when the
  trek ends, and nothing it does while running can throw away unsaved changes or undo history.
- **Changed code gets the attention.** The step's lines are tinted, the change's own lines carry a
  sign in the gutter, and a step in existing code says so quietly.
- **It's always clear you're in a trek, and where.** A badge starts the winbar; the narration sits on a band across the window, so it reads as
  commentary, not code; the step's tint is its own, never the cursor line's; its first line
  carries `▶`, as a debugger's current line does; and once the reader moves away, the winbar
  says so, and a key goes back.
- **Nothing predicted reads as fact.** Every predicted value carries `≈` in place of `=`.
- **Readers see stops, never ids.** A step shows its number among the stops (`9 / 17`), in the
  winbar's strongest text, and its place (repo, file, line); step ids are for the protocol and
  the trek file.
- **Every action answers.** Opening a trek says so at once; a move with nowhere to go says so
  and leaves the cursor where it is.
- **Next and the narration are the whole trek** (`docs/PRODUCT.md`): in Neovim, `]t` and the band
  above the step; in VS Code, `F8` and the top of the sidebar's Stop view.
- **Only what matters is inline.** A high flag shows under the narration; medium and low flags,
  context steps, and evidence are one key away, in details. The band holds the narration and,
  at its end, a medium or low flag (`● risky`) and where next goes (`next: into refund, line 11`),
  which a reader stepping with next alone mustn't miss; the narration itself names the background
  code that explains the step.

### Roles

| Role            | Looks like                                                                                                                                                                                                                                              | Wording                                                                                  | Neovim default    | VS Code default                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------- | --------------------------------- |
| Badge           | `srctrek` at the winbar's start                                                                                                                                                                                                                         |                                                                                          | info colour       | the debug toolbar                 |
| The step        | tinted lines from the window's left edge, under the signs and line numbers too, with a bar in the gutter                                                                                                                                                |                                                                                          | mixed: text 8%    | `editor.rangeHighlightBackground` |
| Current line    | `▶` in the gutter on the step's first line                                                                                                                                                                                                              |                                                                                          | `DiagnosticWarn`  | the debugger's current line       |
| Narration       | a band across the window above the step, half a row of padding above and below, the lower half of the bottom row already the step's tint so the two read as one block; its text in the code's column, wrapped at about 90 characters, six lines at most | the step's summary                                                                       | mixed: info 22%   | the sidebar's own                 |
| Added line      | `+` in the gutter                                                                                                                                                                                                                                       |                                                                                          | `Added`           | `editorGutter.addedBackground`    |
| Changed line    | `~` in the gutter                                                                                                                                                                                                                                       |                                                                                          | `Changed`         | `editorGutter.modifiedBackground` |
| Existing code   | a muted tag beside the stop number in the winbar                                                                                                                                                                                                        | “existing code”                                                                          | `Comment`         | `descriptionForeground`           |
| New file        | a muted tag beside the stop number in the winbar; no signs                                                                                                                                                                                              | “new file”                                                                               | `Comment`         | `descriptionForeground`           |
| Predicted value | `name ≈ value` (`returns ≈ value`), italic, at the line's end, cut at about 40 characters                                                                                                                                                               | “predicted” in details, in full                                                          | `LspInlayHint`    | `editorInlayHint.foreground`      |
| Doubtful value  | `name ≈? value`                                                                                                                                                                                                                                         | “predicted, unsure”                                                                      | `DiagnosticWarn`  | `editorWarning.foreground`        |
| High flag       | `⚠` line under the narration, tinted                                                                                                                                                                                                                    | “likely wrong”                                                                           | `DiagnosticError` | `editorError.foreground`          |
| Medium flag     | `●` in details                                                                                                                                                                                                                                          | “risky”                                                                                  | `DiagnosticWarn`  | `editorWarning.foreground`        |
| Low flag        | `●` in details                                                                                                                                                                                                                                          | “worth knowing”                                                                          | `DiagnosticInfo`  | `editorInfo.foreground`           |
| Cited link      | in details: the stop it came from, then each cited line with its code under it                                                                                                                                                                          | “Reached from stop 7 · publish”                                                          | `Normal`          | `foreground`                      |
| Guessed link    | in details, marked guessed; a “guessed link” tag in the winbar of the step it reaches; `→?` on the line it was guessed from                                                                                                                             | “(guessed: matched by name)”                                                             | `DiagnosticHint`  | `editorHint.foreground`           |
| Stale step      | a tag in the winbar and details                                                                                                                                                                                                                         | “stale: file changed since”                                                              | `DiagnosticWarn`  | `editorWarning.foreground`        |
| Trek's version  | a tag in the winbar; the file opens read-only, its diagnostics hidden until the trek ends                                                                                                                                                               | “trek's version”                                                                         | `DiagnosticHint`  | a read-only editor                |
| Where next goes | a muted note at the band's end; the arrow on the line it enters from is bold                                                                                                                                                                            | “next: into refund, line 11”, “next: ↯ api: POST /refunds”, “next: back to createRefund” | `Comment`         |                                   |
| Away            | a tag at the winbar's right end                                                                                                                                                                                                                         | “away”                                                                                   | `Comment`         |                                   |
| Hop             | `↯` and a dashed rule in the call stack                                                                                                                                                                                                                 | “hop · HTTP request from …”                                                              | `Comment`         | `descriptionForeground`           |
| Context steps   | named in the narration; a “context available” tag in the winbar; `<leader>tx` shows them                                                                                                                                                                | “context available”                                                                      | info colour       | `descriptionForeground`           |
| Call to enter   | `→` at the end of the line making it                                                                                                                                                                                                                    | `↯ api` into another repo                                                                | `Special`         | `textLink.foreground`             |

### Winbar

The stop number, its tags ("existing code" or "new file", "guessed link", "context available",
"trek's version", "stale"),
the step's place as `repo: path` with the repo in its own colour, and the call stack, its frames
below the step's dimmed; every part is split from the next by a dim `¦`. "away" sits at the right end, so it
doesn't move the rest.

### Call stack

A list of frames (VS Code's sidebar) puts the newest on top, as in a debugger. A line of them
(Neovim's winbar) reads outermost first, as a path does, `POST /refunds › createRefund ›
publish`, and is cut from the left when it doesn't fit, so the step's own frame stays in view. A
hop separates what one process ran from what started it (`↯` in place of `›`), and a frame across
a hop into another repo names it: `post ↯ api: POST /refunds › createRefund`. The stack goes back
only across hops whose caller waits for an answer, such as a request; a hop nobody waits on, such
as a queued message or an event, starts a fresh stack, which names its cause dimmed: `started by
api: publish ↯ worker: poll_once`. Each frame shows its step's name (`createRefund`), or its place
(`handlers/refunds.ts:8`) when the trek gives no name. The route lists steps the same way.

### Calls

A line that makes a call the trek follows ends in `→`; the line already says what it calls, so
the arrow carries no text, except a hop into another repo, which names it (`↯ api`). Into takes
the call on the cursor's line, and the first not yet visited when that line makes none, so a
step opens ready to enter its first call. A call whose evidence points at no line of the step has no arrow; next and into still reach it.

### Context steps

Context steps aren't stops: next and prev pass over them. The narration of the step they explain
names the background with the reason to look ("the button was drawn by renderOrder, which put the
order id and amount on it"), and the winbar says "context available"; the overview names the key. The key opens the
context code in a float over the step, each piece under its reason, so the trek stays put and
closing the float is the way back; enter on a piece opens it as a step. Details list them too.

## Editor screens

Neovim and VS Code side by side, in the review page for Step 5c. Neovim draws the trek in the
user's own windows, with virtual lines, the winbar, and floats, and no sidebar; quitting puts back
what each window showed. VS Code gives an extension no styled room between lines of code, so its
narration, flag, and where next goes open the srctrek sidebar's Stop view, above the call stack
and details; the line above the step holds a row of actions (the stop, its flag, its context, and
next), and the sidebar also lists the treks.

| Screen           | Neovim                                                            | VS Code                                                                      |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Choosing a trek  | in the terminal: `trek` opens the chosen trek with `:Trek <name>` | the srctrek view: treks with their status                                    |
| Overview         | a float: the story, trigger, outcome, repos, flags, and the keys  | a trek tab                                                                   |
| A step           | narration and high flag as virtual lines; values at the           | narration and flag atop the Stop view, actions above the step; values inline |
|                  | ends of their lines; position and stack in the winbar             | decorations; the call stack in the Stop view                                 |
| Details          | a float: came from, flags, values, context, notes                 | the rest of the Stop view                                                    |
| Into, of several | the call on the cursor's line, else the first not visited         | the same                                                                     |
| The end          | a float: the outcome, every flag to jump to                       | the trek tab: the outcome, every flag to jump to                             |
| Asking           | a prompt; the answer in a float with its citations                | an input box; the answer in the sidebar's Notes                              |

Answers to questions are saved
on the step as notes, which details show from then on.

### Keys

While a trek is open; every key can be changed or turned off, and in Neovim each action is also a
command (`:TrekNext`) and a Lua function.

| Action              | Neovim                     | VS Code                      |
| ------------------- | -------------------------- | ---------------------------- |
| Next, previous      | `]t`, `[t`                 | `F8`, `Shift+F8`             |
| Over                | `<leader>tn`               | `F10`                        |
| Into, out           | `<leader>ti`, `<leader>to` | `F11`, `Shift+F11`           |
| Back to the step    | `<leader>tc`               | srctrek: Show Current Stop   |
| Context code        | `<leader>tx`               | srctrek: Show Context        |
| Details             | `<leader>tt`               | the sidebar's Stop view      |
| Show or hide values | `<leader>tv`               | srctrek: Show or Hide Values |
| Ask (later)         | `<leader>ta`               | srctrek: Ask                 |
| Quit the trek       | `<leader>tq`               | `Escape` in the end tab      |

In VS Code the keys step a trek only while no debug session runs.

## Terminal screens

Mocked up in [design/terminal-screens.html](design/terminal-screens.html), which changes with the
screens. Text and the background are the terminal's own. Once the terminal reports its colours,
the states (good, stale, failed, building) and the accent are srctrek's, a bright set on a dark
background and deeper ones on a light one, and secondary text is mixed 60% of the way from the
terminal's background to its text; until then, or if it never reports them, the terminal's own
bright ANSI colours and its dim grey. Each state also has its own symbol: `●` ready,
`≠` stale, `↻` older guide, `✕` failed or can't open, `◐` building, `■` stopped, `✓` done, `○` none yet, `◇` the ways in
found.
Every screen's footer lists its keys, each key bold in the text's colour, then a colon and what it
does dimmed, split from the next by a dim `¦`, with `enter` drawn as `↵`:
`↵: open  ¦  a: add repos  ¦  S: settings  ¦  ?: keys`. Every screen splits the parts of a line
the same way, with a dim `¦` and room around it: `3 commits  ¦  yours`.

- **Landing page,** what `trek` opens on: what's yours. From 110 columns, the list sits beside
  the selected change's own screen, the same as it shows on its own: each row the change's name,
  then its trek's state as a symbol and one mark after it, `⚠` where the agent marked a step
  likely wrong, else `⚑` for a pull request waiting on your review (`● ⚠`, `○ ⚑`); the selected
  row's edge, `▌`, in its state's colour; what the
  change holds and its trek's overview are on the right. Every change listed is worked out in
  the background, one at a time, and kept until the worktree moves on, a pull request until its
  head does, so moving to one shows it at once, a change of this repo then worked out again
  behind it, in case its files have moved on; one not worked out yet keeps the change last shown, then says `◐ opening…` when that takes
  a while. The
  change's keys work from the list, `enter` stepping its trek or building one where there's none,
  and the footer leads with them, then the page's. Narrower, the list is the page, as one table
  across the row, up to 120 columns. The title bar names what the changes are measured against, once:
  `srctrek › against main`. Each row is the change's name, taking
  the room what the rows hold doesn't need, its commits, dimmed (`9 commits`; a pull request's base
  where it isn't the repo's, `into release/2.1`, and `draft`), and its trek's state (`● ready`,
  `≠ stale`, `○ no trek yet`), lined up at the right edge, with when the trek was built where there's
  room: `● ready  built 2h ago`. On a narrow terminal names are cut first, past half the row, and
  what a change holds keeps at least 20 columns. The groups sit under their names, in the accent
  with how many rows each holds (`pull requests 3`), at the page's left, their rows set in under
  them, a blank line before each but the first: checked out first, the branch with its uncommitted
  work set in under it as `uncommitted`; then pull requests, your own open ones (`¦  yours`) and
  those waiting on your review, marked `review requested` in the accent; then your branches, those with a commit of yours (by `user.email`) the base
  doesn't have, latest committed first, the first 8; and code as it is, one row. A branch an open
  pull request was opened from is listed as that pull request alone, here and on `B`. Every other pull
  request and branch is on a view of its own, `p` and `B`, as the done treks are on `d`: treks
  whose work landed or whose branch is gone, each saying how its work ended as its state,
  `✓ merged`. The footer counts each, `p: 28 pull requests  ¦  B: 9 branches  ¦  d: 12 done
treks`. On a view, typing narrows it by name, the title bar saying how many of how many and
  what's typed, `↑`/`↓` move, and `esc` clears what's typed, then goes back. Without `gh`, the
  pull requests' heading says why, `pull requests  ✕ gh: not logged in`. A pull request's trek state comes from its head as listed,
  with nothing fetched: `≠ stale` once the head has moved past the commit its trek was built at.
  The pull requests are read again each minute while the page is in front. `a` slides up
  ADD REPOS from the bottom, the changes dimmed above it with the selected one still marked: every
  repo beside this one, those with work first, ticked with `space` to go with the change, `→` for
  a repo's branches; typing narrows them by name or path, as it does a repo's branches, and `esc`
  clears what's typed, then closes the sheet. Its heading counts those added, and the title bar
  names them on its right: `with api, docs +1`. The selection starts on the branch checked out,
  even with nothing on it yet, and is kept on its row as the lists load and follow the worktree.
  A change being opened says so on its row; one that couldn't be opened says why above the
  footer, until the next key. With no pull requests, their heading says so, `pull requests  none`,
  or why they can't be listed. The list is drawn once what's read here is in, the page
  saying it's reading when that takes a moment; a trek's state being worked out shows the busy
  symbol turning.
- **A change's screen,** opened with enter: the change in the title bar, and over its first two
  lines what it is (a pull request by its title) and, under it, who opened a pull request and
  whether it's a draft, its commits, and its files, each repo's where there are several; then its
  trek's state: no trek yet (what `b` does, or to set an agent in
  settings), building (the steps as they arrive and what the agent read last, a repo it
  proposes with `y` to add and `x` to dismiss), ready (the trek's overview and its likely-wrong
  steps; enter steps it), stale (how many steps' files changed; `b` updates it, enter steps it as
  it is), build failed (the end of its log), can't open (the repo that isn't where it was), built
  with an older guide, nothing to trek. `b` always builds the trek: builds, updates, or builds
  again. A trek saved meanwhile, by `b` or an agent's chat, shows once it's saved. A done trek
  opens on a screen of its own, with just the trek.
- **Code as it is:** its ways in, `○ ways in not found yet` until `b` finds them; then each way
  in with its trek's state and where it's found. Enter steps a way in's trek, `b` builds it, `B`
  finds the ways in again, and the last row, follow a trigger…, asks for one in the user's words.
- **Settings,** opened with `S`: where treks are stepped, the agent's command, building
  automatically (off by default), and colours (srctrek's or the terminal's), each with its value; an
  environment variable overrides the settings file, and settings says so beside the value. The agent
  can set its own command from its chat, through srctrek's MCP server, and a test run says whether a
  command works.
- **Build view,** opened with `l` from a change's screen: the build's state with the trek's title and a
  clock, the steps added with their repo and summary, what the agent read, a rejected round's
  problems, and why a build failed; `tab` shows the log itself. The last ten builds of each trek
  are kept, and `←`/`→` step between them.
- **Route map,** `r` at a stop, over the whole screen: the stops as a call tree, a guide for each
  call a stop sits in, `↯` where a hop reached it and what carried it, its place, change and flag; `▶` where the trek
  is and `n` where it goes next. The functions running at `▶` are named on a line over the tree,
  and their guides down to it are lit. Beside the tree, the chosen stop in full: its place, what it
  says, its predicted values, its flag, what's running there, and how many stops are under it.
  `←` folds the chosen call's stops into its row and `→` unfolds it; `n` and `p` step past what's
  folded, and the side says how many stops they pass. `c` and `f` show only changed or flagged
  stops, `/` finds stops by name, and esc shows them all again. `tab` lays the stops out in a
  column per repo, then as a tree of the trek's files: each repo, its folders each on one line,
  each file with its stops, `▶` and `n` on the files the trek is in and goes to; there `↑`/`↓`
  choose a file and its stop shows beside it. Enter goes to the chosen stop.
- **Stepping,** as good as in the editors: `enter` starts it from a change's screen, at the trek's
  first stop. At a step, its file with the step's lines tinted, change signs in the gutter,
  predicted values and arrows at line ends, and the narration on a band over the step. The line `n` goes in from has `n` after its
  arrow on a chip of its own (`[n]` where the terminal's colours aren't known), and the footer
  says where `n` goes. Beside it on a wide terminal: the stop `n` goes to, how it's reached (`into`,
  `back to`, `on to`, or `↯` and what carries the hop, `↯ on a timer to`), its repo and path cut from the left, or `this file` when it's
  in the stop's own file, what it says, its change and flag; under it, the stop `p` goes back to,
  how the trek came from it, and where it is. The band carries the stop's flag in full. A narrow terminal shows the
  call stack on a line over the code. `i`, `O` and `o` step into, over and out, listed under `?`. `p` from the first stop shows the overview, and the flags come after the last. `e` opens the cursor's line in the user's editor.

### Keys

- **One meaning per letter** on every screen; a capital is a variant of its lowercase key (`o`
  out, `O` over; `d` details, `D` the change; `b` build, `B` find the ways in again).
- **Footers** show the keys that act on what's selected; `?` lists every key of the screen,
  grouped, and any key closes the list. Arrows and `q` are left to `?`.
- **Shared:** `↑`/`↓` or `j`/`k` move, `enter` the main action, `esc` back, `q` quit on the landing
  page and back elsewhere, `?` every key; `b` build, `y` add, `x` stop or dismiss, `l` builds, `e`
  your editor, `S` settings.

| Screen            | Keys                                                                                                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page      | `enter` open the change; beside it, step its trek or build one, and the change's own keys · `a` add repos: type to narrow, `space` add a repo, `→` its branches, `esc` clear or done · `p` other pull requests · `B` other branches · `d` done treks · `S` settings · `?` keys · `q` quit |
| Its views         | type to narrow · `↑`/`↓` move · `enter` open · `esc` clear, then back                                                                                                                                                                                                                     |
| A change's screen | `enter` step it where Step in says · `e` your editor, or `n` here · `b` build, update, or build again · `y` add a proposed repo · `x` stop, or dismiss a proposal · `l` builds · `?` keys · `esc` back                                                                                    |
| Code as it is     | `enter` step a way in's trek · `b` build it · `B` find the ways in again · `?` keys · `esc` back                                                                                                                                                                                          |
| Settings          | `j`/`k` choose · `enter` change · `y` copy the agent request · `esc` back                                                                                                                                                                                                                 |
| Build view        | `tab` the log · `←`/`→` older, newer build · `x` stop · `b` build again · `esc` back                                                                                                                                                                                                      |
| Route map         | `↑`/`↓` move · `enter` go to the stop · `←`/`→` fold · `c`/`f` changed, flagged · `/` find · `tab` calls, repos, files · `r` close                                                                                                                                                        |
| Stepping          | `n`/`p` next, previous · `i` into the call on the cursor's line · `o` out · `O` over ·                                                                                                                                                                                                    |
|                   | `↑`/`↓` the cursor · `.` back to the stop · `enter` look at the cursor's call, `←`/`→` its other places · `d`                                                                                                                                                                             |
|                   | details · `D` the change · `r` route map · `e` your editor · `?` keys · `q` back                                                                                                                                                                                                          |
