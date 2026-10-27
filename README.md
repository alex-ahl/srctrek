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
message. `--uncommitted` includes work not yet committed.

The home screen lists the tours in the .codetrail/tours folder, with their step counts and
high-severity flags; invalid tours are listed with the reason.

| Key       | Action                       |
| --------- | ---------------------------- |
| `↑` / `↓` | Choose a tour (also `k`/`j`) |
| `enter`   | Open it in Neovim            |
| `q`       | Quit                         |

### Stepping in Neovim

The tour opens with an overview. Each step opens its file, highlights its lines, and shows
a summary above them; changed lines carry `+` or `~` in the sign column.

| Key          | Command                     | Action                                     |
| ------------ | --------------------------- | ------------------------------------------ |
| `]t` / `[t`  | `:TrailNext` / `:TrailPrev` | Next / previous step                       |
| `<leader>ti` | `:TrailInto`                | Step into                                  |
| `<leader>to` | `:TrailOut`                 | Step out                                   |
| `<leader>tt` | `:TrailDetails`             | Details: evidence, predicted values, flags |
| `<leader>ta` | `:TrailAsk`                 | Ask your agent about the current step      |
| `<leader>tv` | `:TrailValues`              | Show or hide predicted values              |
| `<leader>tq` | `:TrailQuit`                | End the trail                              |

Keys exist only while a trail is open; the mappings you had on them come back when it ends.
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

`trail mcp` is an MCP server over stdin and stdout. Register it with your agent as a stdio
server whose command is `bun <codetrail>/packages/cli/src/main.ts mcp`, run in the repo you
work in. The agent opens a change with `open_change`, using the same arguments as `trail`,
then reads it at its exact revisions with `list_files`, `read_file`, `search`, and `diff`,
and builds a tour with `start_tour`, `add_steps`, and `finish_tour`; the tour is saved to the
.codetrail/tours folder, where the home screen lists it.

## Where it's going

- `trail main...HEAD` or `trail <pr-url>`: your agent builds a tour of the change, across
  repos, and the home screen shows it while it builds.
- Tours of existing code, from an entry point you pick.
- A route map of the whole trail in the terminal.

Plans after version 1 are in `docs/ROADMAP.md`.
