<p align="center">
  <img src="docs/assets/codetrail-icon.svg" width="128" alt="codetrail icon">
</p>

<h1 align="center">codetrail</h1>

A debugger session for code you haven't run. `trail` takes a change — a git range or pull
requests, across one or more repos — and follows one example scenario from its trigger to
its outcome in execution order, moving your editor to each step: step over, step into,
step out, with a call stack.

Reads code from git, local or remote, and runs nothing. Works with any agent; steps through
trails in Neovim, and in VS Code and its forks.

> **Status:** pre-release, running from a checkout. Today your agent can build a tour through
> `trail mcp`, and you can list tours and step through them in Neovim; see `docs/HANDOFF.md`.

## Try it today

Requires Bun 1.3.14 or later and Neovim 0.10 or later.

```sh
bun install
bun packages/cli/src/main.ts    # in the repo whose tours you want to see
```

Run it in a git repo with a `main` or `master` branch (or `origin/HEAD` set). Arguments
are read as in `trail main...HEAD ../gateway`; a problem with them stops `trail` with a
message. `--uncommitted` includes work not yet committed. `--code` tours code as it is, to
learn how it works: `trail --code="a refund request"` follows that trigger, and plain
`trail --code` has your agent find the code's triggers (routes, commands, handlers, jobs) and
lists them on the home screen: pick one and press `enter` to build its tour, or open it once
it's built.

The home screen lists the tours in the .codetrail/tours folder, with their step counts and
high-severity flags; invalid tours are listed with the reason. Above them, it says where the
tour of your change stands. When there is none, `trail` has your agent build it in the
background (see Building a tour from your agent), and the tour appears when it's saved.
While it builds, the end of its log shows what the agent has done so far (codetrail adds a
`trail:` line for each thing the agent does through it), `l` opens the whole log, and after
a failed build `b` builds again.

| Key       | Action                       |
| --------- | ---------------------------- |
| `↑` / `↓` | Choose a tour (also `k`/`j`) |
| `enter`   | Open it in Neovim            |
| `q`       | Quit                         |

### Stepping in Neovim

`:Trail <name>` opens a tour saved in Neovim's working directory; the plugin starts
`trail serve` there, so `trail` must be on your `PATH` (or set
`vim.g.codetrail = { cmd = { "/path/to/trail", "serve" } }`).

The tour opens with an overview. Each step opens its file, highlights its lines, and shows
a summary above them, with a likely-wrong flag under it; changed lines carry `+` or `~` in
the sign column, predicted values start with `≈`, and the winbar shows the stop number and
the call stack.

| Key          | Command                     | Action                                    |
| ------------ | --------------------------- | ----------------------------------------- |
| `]t` / `[t`  | `:TrailNext` / `:TrailPrev` | Next / previous step                      |
| `<leader>tn` | `:TrailOver`                | Step over                                 |
| `<leader>ti` | `:TrailInto`                | Step into                                 |
| `<leader>to` | `:TrailOut`                 | Step out                                  |
| `<leader>tt` | `:TrailDetails`             | Details: flags, predicted values, context |
| `<leader>ta` | `:TrailAsk`                 | Ask your agent about the current step     |
| `<leader>tv` | `:TrailValues`              | Show or hide predicted values             |
| `<leader>tq` | `:TrailQuit`                | End the tour                              |

Keys exist only while a tour is open; the mappings you had on them come back when it ends.
Change or turn off any key:

```lua
vim.g.codetrail = { keys = { next = "]w", previous = "[w", ask = false } }
```

`keys = false` turns them all off, for mapping the commands yourself.

### Asking

`<leader>ta` runs your agent headless with the current step as context. Set
`CODETRAIL_AGENT` to its headless command line; the question is appended as the last
argument.

### Building a tour from your agent

Register `trail mcp` with your agent as a stdio MCP server, with the command
`bun <codetrail>/packages/cli/src/main.ts mcp`, run in the repo you work in. Then ask in
plain words:

> Build a codetrail tour of this branch.

Name a different change the way you'd give it to `trail`: `main...feature`,
`../api main...feature`, a pull request URL, or `--uncommitted` for work not yet committed.
The agent reads the change at its exact revisions, builds the tour, and saves it to the
.codetrail/tours folder, where the home screen lists it.

To have `trail` start the build itself, set `CODETRAIL_AGENT` to your agent's headless
command line, the same setting Asking uses, including whatever it needs to use the
codetrail server's tools without asking. The instruction is appended as the last argument,
so an option that takes a list of values goes before the one that reads the prompt. A change
with no commits has nothing to tour, and the home screen says so instead of building. Agents that show MCP prompts as
commands also offer `build_tour`.

## Where it's going

- `trail main...HEAD` or `trail <pr-url>`: your agent builds a tour of the change, across
  repos, and the home screen shows it while it builds.
- Tours of existing code, from an entry point you pick.
- A route map of the whole trail in the terminal.

Plans after version 1 are in `docs/ROADMAP.md`.
