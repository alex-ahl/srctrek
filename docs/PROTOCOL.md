# Editor protocol

How editor plugins talk to core. Messages are defined in `packages/core/src/protocol/`; the
view they answer with in `packages/core/src/session/view.ts`.

## Transport

- JSON-RPC 2.0 over stdio, each message framed with a `Content-Length` header, as in the
  Language Server Protocol.
- The client starts `trail serve` in the repo the tours were built in; one client per process.

## Handshake

The client's first request is `initialize`:

- Client sends: `protocol_version` (integer) and `client: { name, version }`.
- Core replies: `protocol_version` and `trail_version`.
- On a version mismatch core answers with an error saying which to update: the plugin or
  `trail`.

## Requests (client → core)

Every request after `initialize` answers with the session's view.

| Method              | Does                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `open(tour, args?)` | Load a saved tour by name and start at its overview; with `trail`'s |
|                     | arguments for the change as it is now, stale steps are marked       |
| `next`, `prev`      | Move one step in tour order, context steps included                 |
| `into(target?)`     | Step into a call or a hop, the first not yet visited unless named   |
| `over`              | Step to the next step not inside the current step's calls           |
| `out`               | Step to the next step outside the current step's function           |
| `goto(step)`        | Jump to a step                                                      |

A move with nowhere to go answers with the view unchanged.

## The view

One of:

- `overview`: title, overview, trigger, outcome, step count.
- `step`: number and count, the absolute path in the repo's checkout, lines, kind, summary,
  details, flag, predicted values, the change's lines in the file, stale, the call stack back
  across every hop (hops marked), the steps it can step into, the context steps that explain
  it, and notes.
- `end`: title, outcome, step count.

Payloads are ready to render: the client decides nothing beyond fitting text to its window.

## Errors

JSON-RPC's own codes for malformed requests, unknown methods, and invalid params; besides them:

| Code | When                                                   |
| ---- | ------------------------------------------------------ |
| 1    | The client speaks another protocol version             |
| 2    | A request came before `initialize`                     |
| 3    | A move came before `open`, or the tour isn't saved     |
| 4    | The tour doesn't load: another format, or invalid      |
| 5    | A repo the tour names isn't there, or lacks its commit |
| 6    | `goto` named a step the tour doesn't have              |

## Definitions and tests

- Requests are validated in core against their definitions.
- Contract tests run each editor client headless against a real `trail serve`.
