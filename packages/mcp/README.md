# @srctrek/mcp

## What it is

The MCP server `trek mcp` runs over stdin and stdout, for the agent that builds a tour.

## What it does, and does not

Does: open a change (`open_change`, with `trek`'s own arguments), let the agent read it at
its exact revisions (`list_files`, `read_file`, `search`, `diff`), and build a tour of it
(`start_tour`, `add_steps`, `finish_tour`), update a saved tour after the change moves on
(`update_tour`), and propose repos the route leads into
(`propose_repo`), recorded for the user to add or dismiss. The guide for building a tour comes as the
`tour_guide` tool and the `build_tour` prompt, and the server's instructions tell the agent
to read it first, so asking in plain words works. Tool descriptions, instructions, and the
guide come from `packages/core/prompts/`.

Does not: read the working tree, hold tour logic, or draw anything. Core resolves and reads;
this package only speaks MCP.

## Where it fits

Depends on `@srctrek/core` and `@modelcontextprotocol/server`. Started by the cli
(`packages/cli/`) as `trek mcp`.

## Why a package of its own

The MCP SDK stays out of core, so core keeps no protocol dependency and the server can follow
the protocol's versions on its own.
