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
its outcome in execution order, in the terminal or your editor: step over, step into, step
out, with a call stack.

Reads code from git, local or remote, and runs nothing. Works with any agent; steps through
treks in the terminal, in Neovim, and in VS Code and its forks.

> **Status:** pre-release, running from a checkout. Your agent builds treks of a change or of
> code as it is through `trek mcp`; `trek` lists them, builds the missing one, and steps a trek
> in the terminal or Neovim; the VS Code extension lists and steps them too. See
> `docs/HANDOFF.md`.

## Try it today

Requires Bun. Neovim or VS Code, to step in an editor.

```sh
bun install                     # in this checkout
bun run build                   # builds dist/trek; put it on your PATH as trek
trek                            # then, in the repo whose change you want to trek
```

Run it in a git repo with a `main` or `master` branch (or `origin/HEAD` set):

- `trek` treks the current branch's change; `trek main...HEAD ../gateway` names the ranges and
  repos. A problem with the arguments stops `trek` with a message.
- `--uncommitted` includes work not yet committed.
- The home screen always shows the code as it is beside the change, to learn how it works: `b`
  on its ways-in row has your agent find the code's triggers (routes, commands, handlers, jobs),
  each listed there to build with `enter`. `trek --code` opens with that section selected, and
  `trek --code="a refund request"` with that trigger's row, built with `b`.
- `C` on the home screen picks another change instead: a branch, a pull request, or code as it
  is, with repos beside this one ticked to go along. While `trek` is open, it follows new
  commits and branch switches.

The title bar names the change. A pane beside the list describes the selected row: the change's
trek and where it stands, the code's ways in or a way in's trek, or another saved trek; on a
narrow terminal, a line over the footer does. Below, it lists
repos your agent proposed, then in sections: your changes (their trek, or a row for them until
it's built), the code as it is (finding its ways in, then each way in with its trek), other treks
of the code, other branches and pull requests, and, folded, treks
whose work is done and files that aren't valid treks. Each trek shows its state against its branch now. With no trek of the
change, `b` has your agent build one in the background; while it builds, the end of its log
shows what the agent has done so far, and `l` opens the build view.

| Key       | Action                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| `↑` / `↓` | Choose a row (also `k`/`j`)                                                            |
| `enter`   | Open the trek's page, or a folded list                                                 |
| `b`       | Build, update, or rebuild the selected row's trek; on its row, find the code's ways in |
| `x`       | Stop a build, or dismiss a proposed repo                                               |
| `l`       | The trek's builds, and each one's log                                                  |
| `C`       | Pick another change                                                                    |
| `E`       | Pick where treks are stepped                                                           |
| `S`       | Settings                                                                               |
| `?`       | Every key                                                                              |
| `q`       | Quit                                                                                   |

Each footer shows the keys for what's selected; `?` lists them all.

A trek's page shows its overview. There, `enter` steps it in the terminal, or in the editor you
picked with `E` or in settings; the other place is one key away (`e` for the editor, `n` for the
terminal), with `b` to build, `x` to stop a build, and `l` for its builds.

To see a trek before building one of your own, `bun scripts/showcase-repo.ts` makes a small repo
with a saved trek, "pay", that uses everything an editor shows, and prints its path to open.

## Building a trek from your agent

Register `trek mcp` with your agent as a stdio MCP server, run in the repo you work in: with
your agent's own command for adding an MCP server, or in its MCP config:

```json
{ "mcpServers": { "srctrek": { "command": "trek", "args": ["mcp"] } } }
```

Restart or reconnect your agent so it sees srctrek's tools. Then ask in plain words:

> Build a trek of this branch.

Name a different change the way you'd give it to `trek`: `main...feature`,
`../api main...feature`, a pull request URL, or `--uncommitted` for work not yet committed. The
agent reads the change at its exact revisions, builds the trek, and saves it to the
.srctrek/treks folder, where the home screen lists it.

To have `trek` build treks itself, it needs the command that runs your agent without a chat.
Open settings (`S` on the home screen), choose Agent, and press `y`: it copies a request to paste
into your agent's chat, and your agent saves its own command. Or type the command there with
`enter`, including whatever it needs to use srctrek's tools without asking; settings checks that
it starts and answers and keeps it in `~/.config/srctrek/settings.json`. `SRCTREK_AGENT`, when
set, overrides the file. The instruction is appended as the last argument, so an option that
takes a list of values goes before the one that reads the prompt.

`b` on the home screen builds; turn on Build automatically in settings to start a build whenever
a change has none. A change with no commits gets no trek, and the home screen says so instead of
building. Agents that show MCP prompts as commands also offer `build_trek`.

## Step through a trek

- **Terminal:** `enter` on a trek's page, or `n` once you picked an editor.
- **Neovim:** `enter` on a trek's page once you picked Neovim, else `e`; or `:Trek <name>` from
  your own Neovim. See [editors/nvim](editors/nvim/README.md).
- **VS Code and its forks:** install the extension, then open a trek from the srctrek sidebar.
  See [editors/vscode](editors/vscode/README.md).

All three step the same way: next and previous in execution order, step over, into, and out, with
the narration and call stack for each stop and the trek's predicted values in the code. In the
terminal:

| Key       | Action                                                            |
| --------- | ----------------------------------------------------------------- |
| `n` / `p` | Next and previous stop                                            |
| `i` / `o` | Step into and out                                                 |
| `O`       | Step over                                                         |
| `↑` / `↓` | Move the cursor through the stop's file                           |
| `enter`   | On a call: the step it leads to, or where its function is defined |
| `d`       | The stop's details: evidence, values, flags                       |
| `D`       | The change to the stop's file                                     |
| `r`       | The route map; `tab` groups it by repo                            |
| `e`       | The cursor's line in your editor                                  |
| `.`       | Back to the stop                                                  |
| `?`       | Every key                                                         |
| `q`       | Back to the home screen                                           |

## Where it's going

- Asking through `trek serve`, with answers saved on the step.
- `trek` without a checkout: `curl -fsSL https://srctrek.dev/install | sh`, once releases are
  published.

Plans after version 1 are in `docs/ROADMAP.md`.

## Contributing

Issues and ideas are welcome; srctrek is pre-release, with no promise of support or timelines.
Pull requests: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE).
