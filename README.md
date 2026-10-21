<p align="center">
  <img src="docs/assets/codetrail-icon.svg" width="128" alt="codetrail icon">
</p>

<h1 align="center">codetrail</h1>

A debugger session for code you haven't run. `trail` takes a change — a git range or pull
requests, across one or more repos — and follows one example scenario from its trigger to
its outcome in execution order, moving your editor to each step: step over, step into,
step out, with a call stack.

Reads code from git, local or remote, and runs nothing. Works with any editor and any agent.

> **Status:** pre-release, not usable yet. See `docs/HANDOFF.md`.

## Install

Not yet published. To build from source (requires Bun >= 1.3.14):

```sh
bun install
bun run build
./dist/trail
```

## Usage

Register `trail mcp` as a stdio MCP server in your agent, then ask it for a trail:

```text
Trail PR <pr-url>, and <pr-url> in the api repo.
Trail main...HEAD in this repo.
```

Then step through it:

```sh
trail                 # the latest tour
trail <tour-name>     # a saved tour
```

| Key           | Action                      |
| ------------- | --------------------------- |
| `n` / `space` | Next step                   |
| `p`           | Previous step               |
| `i`           | Step into                   |
| `o`           | Step out                    |
| `enter`       | Expand or collapse details  |
| `e`           | Open the step in the editor |
| `q`           | Quit                        |
