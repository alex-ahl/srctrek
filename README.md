<p align="center">
  <img src="docs/assets/codetrail-icon.svg" width="128" alt="codetrail icon">
</p>

<h1 align="center">codetrail</h1>

A debugger session for code you haven't run. `trail` takes a change — a git range or pull
requests, across one or more repos — and follows one example scenario from its trigger to
its outcome in execution order, moving your editor to each step: step over, step into,
step out, with a call stack.

Reads code from git, local or remote, and runs nothing. Works with any agent; steps through
tours in Neovim, and later in VS Code and its forks.

> **Status:** pre-release, running from a checkout. Your agent builds tours of a change or of
> code as it is through `trail mcp`; `trail` lists them, builds the missing one, and opens a
> tour in Neovim to step through. See `docs/HANDOFF.md`.

## Try it today

Requires Bun 1.3.14 or later and Neovim 0.10 or later.

```sh
bun install                     # in this checkout
bun run build                   # builds dist/trail
<codetrail>/dist/trail          # then, in the repo whose change you want to tour
```

Run it in a git repo with a `main` or `master` branch (or `origin/HEAD` set). Arguments are
read as in `trail main...HEAD ../gateway`; a problem with them stops `trail` with a message.
`--uncommitted` includes work not yet committed. `--code` tours code as it is, to learn how it
works: `trail --code="a refund request"` follows that trigger, and plain `trail --code` has your
agent find the code's triggers (routes, commands, handlers, jobs) and lists them on the home
screen: pick one and press `enter` to build its tour, or open it once it's built.

The home screen lists the tours in the .codetrail/tours folder, with their stop counts and
likely-wrong flags; invalid tours are listed with the reason. Above them, it says where the tour
of your change stands. When there is none, `trail` has your agent build it in the background
(see Building a tour from your agent), and the tour appears when it's saved. While it builds,
the end of its log shows what the agent has done so far, `l` opens the whole log, and after a
failed build `b` builds again.

| Key       | Action                       |
| --------- | ---------------------------- |
| `↑` / `↓` | Choose a tour (also `k`/`j`) |
| `enter`   | Open it in Neovim            |
| `q`       | Quit                         |

`enter` opens the tour with this checkout's plugin and its own `trail serve`.

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

| Key          | Command                     | Action                                           |
| ------------ | --------------------------- | ------------------------------------------------ |
| `]t` / `[t`  | `:TrailNext` / `:TrailPrev` | Next / previous stop                             |
| `<leader>tn` | `:TrailOver`                | Step over                                        |
| `<leader>ti` | `:TrailInto`                | Step into the call on the cursor's line          |
| `<leader>to` | `:TrailOut`                 | Step out                                         |
| `<leader>tc` | `:TrailCurrent`             | Back to the current stop                         |
| `<leader>tx` | `:TrailContext`             | Context code (contracts, types), when available  |
| `<leader>tt` | `:TrailDetails`             | Details: where it came from, its evidence, flags |
| `<leader>tv` | `:TrailValues`              | Show or hide predicted values                    |
| `<leader>tq` | `:TrailQuit`                | End the tour                                     |

Details say which stop this one was reached from and show each line of evidence with its code;
enter on one opens it. The end of the tour lists every flag, most severe first; enter on one
goes to its stop.

A step opens your own file when it's the version the tour describes. A file you've changed since
opens from the tour's copy, read-only and with its diagnostics hidden.

Keys exist only while a tour is open; the mappings you had on them come back when it ends, and
each window the tour used goes back to the file and place you had. Change or turn off any key:

```lua
vim.g.codetrail = { keys = { next = "]w", previous = "[w", values = false } }
```

`keys = false` turns them all off, for mapping the commands yourself. `:Trail <name>` opens a
saved tour directly; it starts `trail serve` in Neovim's working directory, so `trail` must be
on your `PATH`, or set `vim.g.codetrail = { cmd = { "/path/to/trail", "serve" } }`.

Each step fires `User CodetrailStep` with `{ path, shown, line, repo }`, for a file tree or your
own config to follow: `path` is the file in your project, `shown` the file the step opened.

## Building a tour from your agent

Register `trail mcp` with your agent as a stdio MCP server, with the command
`bun <codetrail>/packages/cli/src/main.ts mcp`, run in the repo you work in. Then ask in plain
words:

> Build a codetrail tour of this branch.

Name a different change the way you'd give it to `trail`: `main...feature`,
`../api main...feature`, a pull request URL, or `--uncommitted` for work not yet committed. The
agent reads the change at its exact revisions, builds the tour, and saves it to the
.codetrail/tours folder, where the home screen lists it.

To have `trail` start the build itself, set `CODETRAIL_AGENT` to your agent's headless command
line, including whatever it needs to use the codetrail server's
tools without asking. The instruction is appended as the last argument, so an option that takes
a list of values goes before the one that reads the prompt. A change with no commits has nothing
to tour, and the home screen says so instead of building. Agents that show MCP prompts as
commands also offer `build_tour`.

## Stepping in VS Code (in progress)

The extension steps a tour as the Neovim plugin does. To try it from this checkout:

```sh
bun run --cwd editors/vscode build
code --extensionDevelopmentPath=<codetrail>/editors/vscode <the repo whose tours you want>
```

- Open a tour with "Codetrail: Open Tour…", or click one under Tours in the codetrail sidebar (its
  icon is in the activity bar); its overview opens in a tab.
- Step with `F8` and `Shift+F8`; `F10`, `F11`, and `Shift+F11` step over, into the call on the
  cursor's line, and out.
- Each stop's narration shows in a panel above its code. VS Code also lists it in its Comments view,
  which it opens by itself the first time.
- Predicted values show at the ends of their lines as `name ≈ value`; "Codetrail: Show or Hide
  Values" turns them off.
- The sidebar's Stop view shows the stop's call stack, where it came from with the code
  each piece of evidence cites, its flag, values, context, details, and questions.
- The end of the tour lists every flag, each a link to its stop.

The extension starts `trail serve` in the workspace folder, so `trail` must be on your `PATH`, or
set `codetrail.serveCommand` to `["<codetrail>/dist/trail", "serve"]`.

## Where it's going

- A VS Code extension, for VS Code and its forks, shipped as a .vsix package with the beta.
- Asking through `trail serve`, with answers saved on the step.
- The terminal's own screens: a route map of the whole tour, a live build view, and stepping
  without an editor.

Plans after version 1 are in `docs/ROADMAP.md`.
