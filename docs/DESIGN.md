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

1. In a repo of the change, run `trek <pull request URL>…`, or `trek` on the branch.
2. `trek` resolves the change, fetching what's remote, and opens the home screen. With no trek
   yet and an agent configured, the build starts at once, and the home screen follows it: the
   overview, then steps as they arrive.
3. A repo the agent proposes appears as a row: add it to the repos list, or dismiss it. The trek
   goes on into it either way.
4. Once saved, the trek is picked out; enter opens its page, and enter there steps it, in the
   terminal or the chosen editor.
5. In the editor: the overview, then next, over, into, and out through the steps, high flags
   inline and predicted values at the ends of their lines; at the end, the outcome.

### 2. Review work in progress

`trek --uncommitted`: as in flow 1, on a snapshot of the working tree, for one's own work or an
agent's.

### 3. Learn unfamiliar code

1. `trek --code` lists the code's triggers (routes, commands, jobs, handlers), each with the line
   that proves it.
2. Picking one builds its trek, which opens as in flow 1. `trek --code="<trigger>"` skips the
   list.

### 4. Come back after the change moved on

The home screen marks the trek stale, with how many steps' files changed; `b` updates it. Until
then the editor marks the stale steps.

### 5. Build from the agent's chat

The user asks their agent for a trek in plain words; the agent builds it through `trek mcp`, and
`trek` finds it on the home screen.

### 6. Ask about a step (Milestone 6)

On a step in the editor: ask a question, see progress while the agent works, read the answer
beside the code with citations to jump to. The answer is saved on the step as a note.

### 7. Step without an editor plugin

From the home screen, the stepping view in the terminal; `e` opens the step in the user's editor
at its line.

### 8. When it doesn't work

- No agent configured: the home screen says how to set `SRCTREK_AGENT`.
- A build failed: the end of its log, `b` to build again, `l` for the whole log.
- A repo isn't reachable: its name and where it was expected.
- A trek from another format version: says so, with a rebuild.
- A change with no commits: nothing to trek.

### Where a session starts

- **From the terminal:** enter on the home screen opens the trek's page: its overview, with what
  acts on the trek. Enter there steps it where the user's Step in setting says: the terminal, the
  default, or an editor found on the machine that can open a trek (Neovim, and `$EDITOR` at the
  first stop without stepping); the other place is one key away, `e` for the editor or `n` for
  the terminal. The choice is kept per user, in `$XDG_CONFIG_HOME/srctrek/settings.json` (else
  `~/.config`); `E` and settings change it.
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
below the step's dimmed; every part is split from the next by a dim `│`. "away" sits at the right end, so it
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
`≠` stale, `↻` older guide, `✕` failed or can't open, `◐` building, `✓` done, `○` none yet.

- **Home:** the change at the top (its branch or pull request, with how many commits since its
  base on the right, after its repos where there are several), then the change's trek with where it stands, then the list in
  sections: repos the agent proposed and ways into the code (they wait on the user), treks of this
  change, treks of other branches and pull requests, treks of code as it is, then done treks
  (merged, branch gone, or their uncommitted work committed since) and files that can't be read,
  folded under a heading with a count that enter opens. Every trek shows its state against its
  branch now, newest first in its section. Enter opens the selected trek's page.
- **The change's trek, by state:** building (enter watches it), ready, stale (with how many steps
  changed; `b` updates it), build failed (the end of its log; `b` builds again), can't open (the
  repo that isn't where it was), built with an older guide (`b` rebuilds), no agent configured
  (how to set `SRCTREK_AGENT`), nothing to trek. With `--code`, the code's triggers, each with
  its trek's state.
- **Settings,** opened with `S`: where treks are stepped, the agent's command, building
  automatically (off by default), and colours (srctrek's or the terminal's), each with its value; an
  environment variable overrides the settings file, and settings says so beside the value. The agent
  can set its own command from its chat, through srctrek's MCP server, and a test run says whether a
  command works.
- **Build view,** opened with `l` from any trek: the build's state with the trek's title and a
  clock, the steps added with their repo and summary, what the agent read, a rejected round's
  problems, and why a build failed; `tab` shows the log itself. The last ten builds of each trek
  are kept, and `←`/`→` step between them.
- **Route map:** one lane per repo, steps in the order they run, hops crossing between lanes,
  change signs and flags in place; a narrow terminal shows it as a list grouped by repo. Enter
  goes to the selected step; `c` and `f` show only changed or flagged steps.
- **Stepping,** as good as in the editors: `enter` starts it from a trek's page. At a step, its file
  with the step's lines tinted, change signs in the gutter, predicted values and arrows at line
  ends, and the narration on a band over the step. Beside it on a wide terminal: what each move
  does, in plain words with the line of the call it's about (`n` into it, `i` into the cursor's
  call, `O` skip it, `o` finish this function) and where it lands, a move landing where `n` does
  left out; then the call stack, context, and flag; a narrow terminal shows the moves and the stack on a
  line each over the code. The overview comes before the first step, the flags after the last. `e` opens the cursor's line in the user's editor.

### Keys

- **One meaning per letter** on every screen; a capital is a variant of its lowercase key (`o`
  out, `O` over; `d` details, `D` the change; `e` your editor, `E` pick it).
- **Footers** show the keys that act on what's selected; `?` lists every key of the screen,
  grouped, and any key closes the list. Arrows and `q` are left to `?`.
- **Shared:** `↑`/`↓` or `j`/`k` move, `enter` the main action, `esc` back, `q` quit on the home
  screen and back elsewhere, `?` every key; `b` build, `x` stop or dismiss, `l` builds, `e` your
  editor, `S` settings.

| Screen      | Keys                                                                                   |
| ----------- | -------------------------------------------------------------------------------------- |
| Home        | `enter` the trek's page · `b` build, update, or rebuild · `x` stop, or dismiss a       |
|             | proposal · `l` builds · `C` pick another change · `E` pick where treks are stepped ·   |
|             | `S` settings · `?` keys · `q` quit                                                     |
| Trek's page | `enter` step it where Step in says · `e` your editor, or `n` here · `b` build · `x`    |
|             | stop · `l` builds · `?` keys · `q` home                                                |
| Settings    | `j`/`k` choose · `enter` change · `y` copy the agent request · `esc` back              |
| Build view  | `tab` the log · `←`/`→` older, newer build · `x` stop · `b` build again · `esc` back   |
| Route map   | `j`/`k` move · `enter` go to the step · `tab` by calls or repos · `r` close            |
| Stepping    | `n`/`p` next, previous · `i` into the call on the cursor's line · `o` out · `O` over · |
|             | `↑`/`↓` the cursor · `.` back to the stop · `enter` look at the cursor's call · `d`    |
|             | details · `D` the change · `r` route map · `e` your editor · `?` keys · `q` home       |
