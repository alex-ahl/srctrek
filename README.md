<p align="center">
  <img src="docs/assets/srctrek-icon.svg" width="128" alt="srctrek icon">
</p>

<h1 align="center">srctrek</h1>

<p align="center">
  <a href="https://github.com/alex-ahl/srctrek/actions/workflows/ci.yml"><img src="https://github.com/alex-ahl/srctrek/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/status-pre--release-f5a623?style=flat-square" alt="Status: pre-release">
  <img src="https://img.shields.io/badge/runs%20on-Bun-0d1640?style=flat-square&logo=bun&logoColor=white" alt="Runs on Bun">
  <img src="https://img.shields.io/badge/TypeScript-strict-1c2f7a?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript, strict">
  <img src="https://img.shields.io/badge/editor-Neovim-36c6f4?style=flat-square&logo=neovim&logoColor=white" alt="Editor: Neovim">
  <img src="https://img.shields.io/badge/editor-VS%20Code-5ff0c0?style=flat-square" alt="Editor: VS Code">
  <img src="https://img.shields.io/badge/MCP-trek%20mcp-6b7cff?style=flat-square" alt="MCP server: trek mcp">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-36c6f4?style=flat-square" alt="License: MIT"></a>
</p>

A debugger session for code you haven't run. `trek` takes a change — a git range or pull
requests, across one or more repos — and follows one example scenario from its trigger to
its outcome in execution order, moving your editor to each step: step over, step into,
step out, with a call stack.

Reads code from git, local or remote, and runs nothing. Works with any agent; steps through
treks in Neovim, and in VS Code and its forks.

> **Status:** pre-release, running from a checkout. Your agent builds treks of a change or of
> code as it is through `trek mcp`; `trek` lists them, builds the missing one, and opens a
> trek in Neovim; the VS Code extension lists and steps them too. See `docs/HANDOFF.md`.

## Try it today

Requires Bun, and Neovim or VS Code.

```sh
bun install                     # in this checkout
bun run build                   # builds dist/trek; put it on your PATH as trek
trek                            # then, in the repo whose change you want to trek
```

Run it in a git repo with a `main` or `master` branch (or `origin/HEAD` set):

- `trek` treks the current branch's change; `trek main...HEAD ../gateway` names the ranges and
  repos. A problem with the arguments stops `trek` with a message.
- `--uncommitted` includes work not yet committed.
- `--code` walks code as it is, to learn how it works: `trek --code="a refund request"` follows
  that trigger, and plain `trek --code` has your agent find the code's triggers (routes,
  commands, handlers, jobs) and list them on the home screen, to build one with `enter`.

The home screen lists the treks in the .srctrek/treks folder, with their stop counts and
likely-wrong flags; invalid treks are listed with the reason. Above them, it says where the trek
of your change stands. When there is none, `trek` has your agent build it in the background
(see Building a trek from your agent, below), and the trek appears when it's saved. While it builds,
the end of its log shows what the agent has done so far, `l` opens the whole log, and after a
failed build `b` builds again.

| Key       | Action                       |
| --------- | ---------------------------- |
| `↑` / `↓` | Choose a trek (also `k`/`j`) |
| `enter`   | Open it in Neovim            |
| `q`       | Quit                         |

To see a trek before building one of your own, `bun scripts/showcase-repo.ts` makes a small repo
with a saved trek, "pay", that uses everything an editor shows, and prints its path to open.

## Building a trek from your agent

Register `trek mcp` with your agent as a stdio MCP server, run in the repo you work in. Then ask
in plain words:

> Build a trek of this branch.

Name a different change the way you'd give it to `trek`: `main...feature`,
`../api main...feature`, a pull request URL, or `--uncommitted` for work not yet committed. The
agent reads the change at its exact revisions, builds the trek, and saves it to the
.srctrek/treks folder, where the home screen lists it.

To have `trek` build treks itself, give it your agent's headless command line, including
whatever it needs to use the srctrek server's tools without asking: in settings (`S` on the home
screen, then Agent), which checks that the command starts and answers and keeps it in
`~/.config/srctrek/settings.json`, or in `SRCTREK_AGENT`, which overrides the file. The
instruction is appended as the last argument, so an option that takes a list of values goes
before the one that reads the prompt. `b` on the home screen builds; turn on Build automatically
in settings (`S`) to start a build whenever a change has none. A change with no commits gets no
trek, and the home screen says so instead of building. Agents that show MCP prompts as commands also offer
`build_trek`.

## Step through a trek

- **Neovim:** `enter` on the home screen opens the trek, or `:Trek <name>` from your own Neovim.
  See [editors/nvim](editors/nvim/README.md).
- **VS Code and its forks:** install the extension, then open a trek from the srctrek sidebar.
  See [editors/vscode](editors/vscode/README.md).

Both step the same way: next and previous in execution order, step over, into, and out, with the
narration and call stack for each stop and the trek's predicted values in the code.

## Where it's going

- Asking through `trek serve`, with answers saved on the step.
- The terminal's own screens: a route map of the whole trek, a live build view, and stepping
  without an editor.

Plans after version 1 are in `docs/ROADMAP.md`.

## License

MIT, see [LICENSE](LICENSE).
