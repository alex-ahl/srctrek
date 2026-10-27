# @codetrail/mcp

## What it is

The MCP server `trail mcp` runs over stdin and stdout, for the agent that builds a tour.

## What it does, and does not

Does: open a change (`open_change`, with `trail`'s own arguments) and let the agent read it
at its exact revisions: `list_files`, `read_file`, `search`, `diff`. Tool descriptions come
from `packages/core/prompts/`.

Does not: read the working tree, hold tour logic, or draw anything. Core resolves and reads;
this package only speaks MCP.

## Where it fits

Depends on `@codetrail/core` and `@modelcontextprotocol/server`. Started by the cli
(`packages/cli/`) as `trail mcp`.

## Why a package of its own

The MCP SDK stays out of core, so core keeps no protocol dependency and the server can follow
the protocol's versions on its own.
