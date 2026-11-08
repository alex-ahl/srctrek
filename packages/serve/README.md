# @srctrek/serve

## What it is

`trek serve`, the editor protocol (`docs/PROTOCOL.md`) over stdin and stdout, for one editor
stepping through the tours saved in the folder it runs in.

## What it does, and does not

Does: speak JSON-RPC over stdio, framed as the Language Server Protocol frames it, check the
handshake's protocol version, and carry out each request on core's stepping session, in the
order requests arrive, answering with its view: open a tour by name, then next, prev, into,
over, out, and goto. For an editor's list of tours, it answers with the saved tours and the
change's status, starts builds, and returns build logs.

Does not: hold stepping logic, build tours itself (it starts the user's agent), or draw
anything. Core steps and renders the view; this package only speaks the protocol.

## Where it fits

Depends on `@srctrek/core` and `vscode-jsonrpc`, which frames messages and matches replies
to requests; it needs no editor. Started by the cli (`packages/cli/`) as `trek serve`,
which an editor's plugin runs as a child process.

## Why a package of its own

The protocol's transport stays out of core, as MCP's does in `packages/mcp/`, so core keeps no
protocol code beyond the messages' definitions, and editors and the agent each get a server
that follows its own protocol.
