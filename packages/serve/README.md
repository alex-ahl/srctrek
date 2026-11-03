# @codetrail/serve

## What it is

`trail serve`, the editor protocol (`docs/PROTOCOL.md`) over stdin and stdout, for one editor
stepping through the tours saved in the folder it runs in.

## What it does, and does not

Does: speak JSON-RPC over stdio, framed as the Language Server Protocol frames it, check the
handshake's protocol version, and carry out each request on core's stepping session, in the
order requests arrive, answering with its view: open a tour by name, then next, prev, into,
over, out, and goto.

Does not: hold stepping logic, build tours, or draw anything. Core steps and renders the view;
this package only speaks the protocol.

## Where it fits

Depends on `@codetrail/core` and `vscode-jsonrpc`, which frames messages and matches replies
to requests; it needs no editor. Started by the cli (`packages/cli/`) as `trail serve`,
which an editor's plugin runs as a child process.

## Why a package of its own

The protocol's transport stays out of core, as MCP's does in `packages/mcp/`, so core keeps no
protocol code beyond the messages' definitions, and editors and the agent each get a server
that follows its own protocol.
