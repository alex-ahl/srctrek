<p align="center">
  <img src="docs/assets/srctrek-icon.svg" width="128" alt="srctrek icon">
</p>

<h1 align="center">srctrek</h1>

A debugger session for code you haven't run. `trek` takes a change — a git range or pull
requests, across one or more repos — and follows one example scenario from its trigger to
its outcome in execution order, moving your editor to each step: step over, step into,
step out, with a call stack.

Reads code from git, local or remote, and runs nothing. Works with any agent; steps through
tours in Neovim, and in VS Code and its forks.

> **Status:** pre-release, running from a checkout. Your agent builds tours of a change or of
> code as it is through `trek mcp`; `trek` lists them, builds the missing one, and opens a
> tour in Neovim; the VS Code extension lists and steps them too. See `docs/HANDOFF.md`.

## Try it today

Requires Bun 1.3.14 or later, and Neovim 0.10 or later or VS Code 1.99 or later.

```sh
bun install                     # in this checkout
bun run build                   # builds dist/trek
<srctrek>/dist/trek             # then, in the repo whose change you want to tour
```

To see a tour before building one of your own, `bun scripts/showcase-repo.ts` makes a small repo
with a saved tour, "pay", that uses everything an editor shows, and prints its path to open.

Run it in a git repo with a `main` or `master` branch (or `origin/HEAD` set). Arguments are
read as in `trek main...HEAD ../gateway`; a problem with them stops `trek` with a message.
`--uncommitted` includes work not yet committed. `--code` tours code as it is, to learn how it
works: `trek --code="a refund request"` follows that trigger, and plain `trek --code` has your
agent find the code's triggers (routes, commands, handlers, jobs) and lists them on the home
screen: pick one and press `enter` to build its tour, or open it once it's built.

The home screen lists the tours in the .srctrek/tours folder, with their stop counts and
likely-wrong flags; invalid tours are listed with the reason. Above them, it says where the tour
of your change stands. When there is none, `trek` has your agent build it in the background
(see Building a tour from your agent), and the tour appears when it's saved. While it builds,
the end of its log shows what the agent has done so far, `l` opens the whole log, and after a
failed build `b` builds again.

| Key       | Action                       |
| --------- | ---------------------------- |
| `↑` / `↓` | Choose a tour (also `k`/`j`) |
| `enter`   | Open it in Neovim            |
| `q`       | Quit                         |

`enter` opens the tour with this checkout's plugin and its own `trek serve`.

## Stepping in Neovim

The tour opens with an overview: what the change does, its trigger and outcome, its repos and
flags, and the keys. Then `]t` steps through it in execution order, and each stop shows:

- **The narration** on a band above the step's code: what happens here, why it matters for the
  scenario, and how it follows from the last stop. A likely-wrong flag sits under it; a risky
  or worth-knowing one, and where `]t` goes next (`next: into post, line 6`), end it.
- **The step's code**, tinted, with `▶` on its first line, `+` or `~` beside the lines the change
  touches, predicted values at the ends of their lines (always `≈`, as nothing runs), and `→` on
  each line that makes a call the tour follows; the one `]t` enters from is bold, and `→?` marks a
  call the tour matched only by name.
- **The winbar**: the stop number, "existing code" or "new file" when that's what the step is,
  "guessed link" when the tour couldn't prove how it got here, "context available" when it has
  context code, the repo and file, and the call stack, outermost first. A hop
  into another repo is marked `↯`; a hop nobody waits on, such as a queued message, starts a
  fresh stack and names what started it. The winbar says "tour's version" when the file is the
  tour's copy, and "away" once you've moved off the step.

| Key          | Command                   | Action                                           |
| ------------ | ------------------------- | ------------------------------------------------ |
| `]t` / `[t`  | `:TrekNext` / `:TrekPrev` | Next / previous stop                             |
| `<leader>tn` | `:TrekOver`               | Step over                                        |
| `<leader>ti` | `:TrekInto`               | Step into the call on the cursor's line          |
| `<leader>to` | `:TrekOut`                | Step out                                         |
| `<leader>tc` | `:TrekCurrent`            | Back to the current stop                         |
| `<leader>tx` | `:TrekContext`            | Context code (contracts, types), when available  |
| `<leader>tt` | `:TrekDetails`            | Details: where it came from, its evidence, flags |
| `<leader>tv` | `:TrekValues`             | Show or hide predicted values                    |
| `<leader>tq` | `:TrekQuit`               | End the tour                                     |

Details say which stop this one was reached from and show each line of evidence with its code;
enter on one opens it. The end of the tour lists every flag, most severe first; enter on one
goes to its stop.

A step opens your own file when it's the version the tour describes. A file you've changed since
opens from the tour's copy, read-only and with its diagnostics hidden.

Keys exist only while a tour is open; the mappings you had on them come back when it ends, and
each window the tour used goes back to the file and place you had. Change or turn off any key:

```lua
vim.g.srctrek = { keys = { next = "]w", previous = "[w", values = false } }
```

`keys = false` turns them all off, for mapping the commands yourself. `:Trek <name>` opens a
saved tour directly; it starts `trek serve` in Neovim's working directory, so `trek` must be
on your `PATH`, or set `vim.g.srctrek = { cmd = { "/path/to/trek", "serve" } }`.

Each step fires `User SrctrekStep` with `{ path, shown, line, repo }`, for a file tree or your
own config to follow: `path` is the file in your project, `shown` the file the step opened.

## Building a tour from your agent

Register `trek mcp` with your agent as a stdio MCP server, with the command
`bun <srctrek>/packages/cli/src/main.ts mcp`, run in the repo you work in. Then ask in plain
words:

> Build a srctrek tour of this branch.

Name a different change the way you'd give it to `trek`: `main...feature`,
`../api main...feature`, a pull request URL, or `--uncommitted` for work not yet committed. The
agent reads the change at its exact revisions, builds the tour, and saves it to the
.srctrek/tours folder, where the home screen lists it.

To have `trek` start the build itself, set `SRCTREK_AGENT` to your agent's headless command
line, including whatever it needs to use the srctrek server's
tools without asking. The instruction is appended as the last argument, so an option that takes
a list of values goes before the one that reads the prompt. A change with no commits has nothing
to tour, and the home screen says so instead of building. Agents that show MCP prompts as
commands also offer `build_tour`.

## Stepping in VS Code

The extension steps a tour as the Neovim plugin does, in VS Code and its forks. Package and install
it from this checkout:

```sh
bun run --cwd editors/vscode package
code --install-extension editors/vscode/dist/srctrek.vsix
```

- Open a tour with "Srctrek: Open Tour…", or click one under Tours in the srctrek sidebar (its
  icon is in the activity bar); its overview opens in a tab, with the keys and what the marks in
  the code mean.
- Step with `F8` and `Shift+F8`; `F10`, `F11`, and `Shift+F11` step over, into the call on the
  cursor's line, and out.
- The sidebar's Stop view starts with the stop's narration, its details, its flag, and where
  `F8` goes next; below come the call stack, where it came from with the code each piece of
  evidence cites, its context code, and questions.
- The line above the step holds its actions: the stop and its flag open the Stop view,
  "context" scrolls it to the context code, and "next" steps on.
- In the code: a green or blue bar in the gutter beside each line the change adds or edits,
  predicted values at the ends of their lines (`name ≈ value`; "Srctrek: Show or Hide Values"
  turns them off), and `→` on each line that makes a call the tour follows (`→?` when guessed).
- "Srctrek: Show Current Stop" goes back to the stop after you've moved off it.
- The end of the tour lists every flag, each a link to its stop. `Escape` there, or "Srctrek: End
  the Tour", ends it.

The extension starts `trek serve` in the workspace folder, so `trek` must be on your `PATH`, or
set `srctrek.serveCommand` to `["<srctrek>/dist/trek", "serve"]`. VS Code started from the Dock
or Finder doesn't see your shell's `PATH`; there, set the full path.

## Where it's going

- Asking through `trek serve`, with answers saved on the step.
- The terminal's own screens: a route map of the whole tour, a live build view, and stepping
  without an editor.

Plans after version 1 are in `docs/ROADMAP.md`.
