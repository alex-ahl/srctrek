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
  override a role without changing their theme.
- **Changed code gets the attention.** The step's lines are tinted, the change's own lines carry a
  sign in the gutter, and an unchanged step says so quietly.
- **Nothing predicted reads as fact.** Every predicted value starts with `≈`.
- **Only what matters is inline.** A high flag shows under the narration; medium and low flags,
  context steps, and evidence are one key away, in details.

### Roles

| Role            | Looks like                                    | Wording                     | Neovim default    | VS Code default                   |
| --------------- | --------------------------------------------- | --------------------------- | ----------------- | --------------------------------- |
| The step        | tinted lines, a bar at the left edge          |                             | `CursorLine`      | `editor.rangeHighlightBackground` |
| Narration       | `▶` above the first line, three lines at most | the step's summary          | `Normal`          | `editorCodeLens.foreground`       |
| Added line      | `+` in the gutter                             |                             | `DiffAdd`         | `editorGutter.addedBackground`    |
| Changed line    | `~` in the gutter                             |                             | `DiffChange`      | `editorGutter.modifiedBackground` |
| Unchanged step  | a muted tag after the narration               | “unchanged”                 | `Comment`         | `descriptionForeground`           |
| Predicted value | `≈ name = value`, italic, at the line's end   | “predicted” in details      | `LspInlayHint`    | `editorInlayHint.foreground`      |
| Doubtful value  | `≈? name = value`                             | “predicted, unsure”         | `DiagnosticWarn`  | `editorWarning.foreground`        |
| High flag       | `⚠` line under the narration, tinted          | “likely wrong”              | `DiagnosticError` | `editorError.foreground`          |
| Medium flag     | `●` in details                                | “risky”                     | `DiagnosticWarn`  | `editorWarning.foreground`        |
| Low flag        | `●` in details                                | “worth knowing”             | `DiagnosticInfo`  | `editorInfo.foreground`           |
| Cited link      | `→`, with its evidence                        | “came from”                 | `Normal`          | `foreground`                      |
| Guessed link    | `⇢`                                           | “guessed: matched by name”  | `DiagnosticHint`  | `editorHint.foreground`           |
| Stale step      | a tag in the winbar and details               | “stale: file changed since” | `DiagnosticWarn`  | `editorWarning.foreground`        |
| Hop             | `↯` and a dashed rule in the call stack       | “hop · HTTP request from …” | `Comment`         | `descriptionForeground`           |
| Context steps   | a count under the code, opened from it        | “2 context steps”           | `Comment`         | `descriptionForeground`           |

### Call stack

Newest frame on top, as in a debugger; a hop separates what one process ran from what started
it.

### Context steps

Context steps aren't stops: next and prev pass over them, and the step they explain shows how many
it has, opened on demand.
