# Design

How every surface looks and behaves. Milestone 6 builds the editors from it, Milestone 7 the
terminal. Status: Milestone 5, in progress.

## Surfaces

- **Terminal** (`trail`): choosing a change, watching its tour being built, the whole route at
  once, and stepping for editors without a plugin.
- **Editor** (the Neovim plugin, the VS Code extension): stepping through a tour.
- **The agent's chat:** building a tour by asking for one.
- **GUI** (later): screens shared with the VS Code extension.

## Flows

### 1. Review a pull request

1. In a repo of the change, run `trail <pull request URL>…`, or `trail` on the branch.
2. `trail` resolves the change, fetching what's remote, and opens the home screen. With no tour
   yet and an agent configured, the build starts at once, and the home screen follows it: the
   overview, then steps as they arrive.
3. A repo the agent proposes appears as a row: add it to the repos list, or dismiss it. The tour
   goes on into it either way.
4. Once saved, the tour is picked out; enter opens it in the editor.
5. In the editor: the overview, then next, over, into, and out through the steps, high flags
   inline and predicted values at the ends of their lines; at the end, the outcome.

### 2. Review work in progress

`trail --uncommitted`: as in flow 1, on a snapshot of the working tree, for one's own work or an
agent's.

### 3. Learn unfamiliar code

1. `trail --code` lists the code's triggers (routes, commands, jobs, handlers), each with the line
   that proves it.
2. Picking one builds its tour, which opens as in flow 1. `trail --code="<trigger>"` skips the
   list.

### 4. Come back after the change moved on

The home screen marks the tour stale, with how many steps' files changed; `b` updates it. Until
then the editor marks the stale steps.

### 5. Build from the agent's chat

The user asks their agent for a tour in plain words; the agent builds it through `trail mcp`, and
`trail` finds it on the home screen.

### 6. Ask about a step (Milestone 6)

On a step in the editor: ask a question, see progress while the agent works, read the answer
beside the code with citations to jump to. The answer is saved on the step as a note.

### 7. Step without an editor plugin

From the home screen, the stepping view in the terminal; `e` opens the step in the user's editor
at its line.

### 8. When it doesn't work

- No agent configured: the home screen says how to set `CODETRAIL_AGENT`.
- A build failed: the end of its log, `b` to build again, `l` for the whole log.
- A repo isn't reachable: its name and where it was expected.
- A tour from another format version: says so, with a rebuild.
- A change with no commits: nothing to tour.

### Where a session starts

- **From the terminal:** enter on the home screen opens the tour in the editor that
  `CODETRAIL_EDITOR` names (`nvim`, `code`, …); nothing is detected. Without it, `$EDITOR` opens
  the step at its line.
- **From the editor:** the plugin or extension lists the saved tours with their status (ready,
  stale, building, failed), opens one, and starts a build. The protocol gains the requests for
  this in Milestone 6.

### Open

- **Terminal and editor together:** the route map following the editor's step needs several
  clients on one session (`docs/ROADMAP.md`).

## Visual language

The vocabulary every surface shares, shown in place on a step in the review page for Step 5b.

### Principles

- **The editor's theme wins.** Each role is named (`CodetrailFlagHigh` in Neovim,
  `codetrail.flagHigh` in VS Code) and defaults to a colour the theme already defines; users
  override a role without changing their theme. Text at a line's end or in the gutter takes
  only the theme colour's foreground. No theme group is distinct from the background in every
  theme, so the step's tint, the narration's band, and the badge are mixed from the theme's
  text, background, and info colours.
- **The user's own files, where they can be.** A step opens the user's own file when it's the
  version the tour describes; only a file that differs opens from the tour's copy, read-only.
- **Nothing the user has is lost.** A tour changes no file, buffer, window, key, or setting of the
  user's for good: whatever it borrows (a window, a key, the winbar) comes back as it was when the
  tour ends, and nothing it does while running can throw away unsaved changes or undo history.
- **Changed code gets the attention.** The step's lines are tinted, the change's own lines carry a
  sign in the gutter, and an unchanged step says so quietly.
- **It's always clear you're in a tour, and where.** A badge starts the winbar; the narration sits on a band across the window, so it reads as
  commentary, not code; the step's tint is its own, never the cursor line's; its first line
  carries `▶`, as a debugger's current line does; and once the reader moves away, the winbar
  says so and how to get back.
- **Nothing predicted reads as fact.** Every predicted value starts with `≈`.
- **Readers see stops, never ids.** A step shows its number among the stops (`9 / 17`), in the
  winbar's strongest text, and its place (repo, file, line); step ids are for the protocol and
  the tour file.
- **Every action answers.** Opening a tour says so at once; a move with nowhere to go says so
  and leaves the cursor where it is.
- **Only what matters is inline.** A high flag shows under the narration; medium and low flags,
  context steps, and evidence are one key away, in details. What details hold beyond every
  step's own text and evidence is named at the end of the band, so it's clear when they're worth
  opening: `● risky`, `⇢ guessed link`, `2 notes`.

### Roles

| Role            | Looks like                                                                     | Wording                     | Neovim default    | VS Code default                   |
| --------------- | ------------------------------------------------------------------------------ | --------------------------- | ----------------- | --------------------------------- |
| Badge           | `codetrail` at the winbar's start                                              |                             | info colour       | the debug toolbar                 |
| The step        | tinted lines, a bar at the left edge                                           |                             | mixed: text 8%    | `editor.rangeHighlightBackground` |
| Current line    | `▶` in the gutter on the step's first line                                     |                             | `DiagnosticWarn`  | the debugger's current line       |
| Narration       | a band above the first line with a `▌` edge, three lines at most               | the step's summary          | mixed: info 22%   | `editorCodeLens.foreground`       |
| Added line      | `+` in the gutter                                                              |                             | `Added`           | `editorGutter.addedBackground`    |
| Changed line    | `~` in the gutter                                                              |                             | `Changed`         | `editorGutter.modifiedBackground` |
| Unchanged step  | a muted tag after the narration                                                | “unchanged”                 | `Comment`         | `descriptionForeground`           |
| New file        | a muted tag after the narration, no signs                                      | “new file”                  | `Comment`         | `descriptionForeground`           |
| Predicted value | `≈ name = value`, italic, at the line's end                                    | “predicted” in details      | `LspInlayHint`    | `editorInlayHint.foreground`      |
| Doubtful value  | `≈? name = value`                                                              | “predicted, unsure”         | `DiagnosticWarn`  | `editorWarning.foreground`        |
| High flag       | `⚠` line under the narration, tinted                                           | “likely wrong”              | `DiagnosticError` | `editorError.foreground`          |
| Medium flag     | `●` in details                                                                 | “risky”                     | `DiagnosticWarn`  | `editorWarning.foreground`        |
| Low flag        | `●` in details                                                                 | “worth knowing”             | `DiagnosticInfo`  | `editorInfo.foreground`           |
| Cited link      | `→`, with its evidence                                                         | “came from”                 | `Normal`          | `foreground`                      |
| Guessed link    | `⇢`                                                                            | “guessed: matched by name”  | `DiagnosticHint`  | `editorHint.foreground`           |
| Stale step      | a tag in the winbar and details                                                | “stale: file changed since” | `DiagnosticWarn`  | `editorWarning.foreground`        |
| Tour's version  | a tag in the winbar; the file opens read-only                                  | “tour's version”            | `DiagnosticHint`  | a read-only editor                |
| Away            | a tag in the winbar                                                            | “away · <leader>tc returns” | `Comment`         |                                   |
| Hop             | `↯` and a dashed rule in the call stack                                        | “hop · HTTP request from …” | `Comment`         | `descriptionForeground`           |
| Context steps   | named on the band; in the step's file, `◇` down the gutter beside its code too | “◇ not_opened, above”       | info colour       | `descriptionForeground`           |
| Call to enter   | `→` at the end of the line making it                                           | `↯ api` into another repo   | `Special`         | `textLink.foreground`             |

### Call stack

A list of frames (VS Code's sidebar) puts the newest on top, as in a debugger. A line of them
(Neovim's winbar) reads outermost first, as a path does, `POST /refunds › createRefund ›
publish`, and is cut from the left when it doesn't fit, so the step's own frame stays in view. A
hop separates what one process ran from what started it (`↯` in place of `›`). Each frame shows
its step's name (`createRefund`), or its place (`handlers/refunds.ts:8`) when the tour gives no
name. The route lists steps the same way.

### Calls

A line that makes a call the tour follows ends in `→`; the line already says what it calls, so
the arrow carries no text, except a hop into another repo, which names it (`↯ api`). Into takes
the call on the cursor's line, and the first not yet visited when that line makes none, so a
step opens ready to enter its first call. A call whose evidence points at no line of the step has no arrow; next and into still reach it.

### Context steps

Context steps aren't stops: next and prev pass over them. The band of the step they explain names
each, since the reader's eyes are there: `◇ not_opened, above` when its code is in the step's file
(or "below", or "in this step"), else `◇ is_fresh · tab.lua:12`. Code in the step's file is also
marked in place, `◇` down the gutter beside its lines and its summary at the end of its first,
with the window scrolled to show it beside the step when both fit. Details list them, and enter
opens one.

## Editor screens

Neovim and VS Code side by side, in the review page for Step 5c. Neovim draws the tour in the
user's own windows, with virtual lines, the winbar, and floats, and no sidebar; quitting puts back
what each window showed. VS Code can't put lines of text
between lines of code, so its narration and high flag sit in a CodeLens above the step, and a
codetrail sidebar holds the tours, the route, the call stack, details, and notes.

| Screen           | Neovim                                                              | VS Code                                                  |
| ---------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| Choosing a tour  | in the terminal: `trail` opens the chosen tour with `:Trail <name>` | the codetrail view: tours with their status              |
| Overview         | a float: the story, trigger, outcome, repos, flags, and the keys    | an editor tab, the route in the sidebar                  |
| A step           | narration and high flag as virtual lines; values at the             | narration and high flag in a CodeLens; values as inline  |
|                  | ends of their lines; position and stack in the winbar               | decorations; call stack and route in the sidebar         |
| Details          | a float: came from, flags, values, context, notes                   | the sidebar's Details section; flags' full text on hover |
| Into, of several | the call on the cursor's line, else the first not visited           | the same                                                 |
| The end          | a float: the outcome, every flag to jump to                         | the tour tab: the outcome, every flag to jump to         |
| Asking           | a prompt; the answer in a float with its citations                  | an input box; the answer in the sidebar's Notes          |

Answers to questions are saved
on the step as notes, which details show from then on.

### Keys

While a tour is open; every key can be changed or turned off, and in Neovim each action is also a
command (`:TrailNext`) and a Lua function.

| Action              | Neovim                     | VS Code                      |
| ------------------- | -------------------------- | ---------------------------- |
| Next, previous      | `]t`, `[t`                 | `Alt+]`, `Alt+[`             |
| Over                | `<leader>tn`               | `F10`                        |
| Into, out           | `<leader>ti`, `<leader>to` | `F11`, `Shift+F11`           |
| Back to the step    | `<leader>tc`               | Codetrail: Show Current Step |
| Details             | `<leader>tt`               | the Details section          |
| Show or hide values | `<leader>tv`               | Codetrail: Toggle Values     |
| Ask                 | `<leader>ta`               | Codetrail: Ask               |
| Quit the tour       | `<leader>tq`               | `Escape` in the tour tab     |

In VS Code the debugger's keys step a tour only while no debug session runs.

## Terminal screens

In the review page for Step 5d. Colours are the terminal's own: green, yellow, red, blue, and
dim, in the roles of the visual language.

- **Home:** the change at the top, then the change's tour with where it stands, repos the agent
  proposed (they wait on the user), and every other tour with its state. Enter opens the selected
  tour in the editor `CODETRAIL_EDITOR` names.
- **The change's tour, by state:** building (enter watches it), ready, stale (with how many steps
  changed; `b` updates it), build failed (the end of its log; `b` builds again), can't open (the
  repo that isn't where it was), built with an older guide (`b` rebuilds), no agent configured
  (how to set `CODETRAIL_AGENT`), nothing to tour. With `--code`, the code's triggers, each with
  its tour's state.
- **Build view,** a screen of its own opened from a building tour: the overview as soon as the
  agent starts, steps as they arrive grouped by repo with hops between, what the agent is reading,
  rejected rounds with their problems, and repos it proposed.
- **Route map:** one lane per repo, steps in the order they run, hops crossing between lanes,
  change signs and flags in place; a narrow terminal shows it as a list grouped by repo. Enter
  opens the selected step in the editor; `c` and `f` show only changed or flagged steps.
- **Stepping:** the step's code with narration, values, and signs, the call stack beside it, for
  anyone: `s` starts it from the home screen or the route map. `e` opens the step in `$EDITOR` at
  its line.

### Keys

| Screen     | Keys                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| Home       | `j`/`k` move · `enter` open in the editor · `b` build, update, or rebuild · `r` route map ·  |
|            | `s` step here · `l` log · `d` dismiss a proposal · `q` quit                                  |
| Build view | `l` full log · `esc` home                                                                    |
| Route map  | `j`/`k` move · `enter` open the step in the editor · `s` step from here · `c` changed only · |
|            | `f` flagged only · `esc` home                                                                |
| Stepping   | `n`/`p` next, previous · `i` into · `o` out · `O` over · `t` details · `e` open in           |
|            | `$EDITOR` · `r` route map · `q` home                                                         |
