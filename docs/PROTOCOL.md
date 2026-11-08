# Editor protocol

How editor plugins talk to core. Messages are defined in `packages/core/src/protocol/`; the
view they answer with in `packages/core/src/session/view.ts`.

## Transport

- JSON-RPC 2.0 over stdio, each message framed with a `Content-Length` header, as in the
  Language Server Protocol.
- The client starts `trek serve` in the repo the tours were built in; one client per process.

## Handshake

The client's first request is `initialize`:

- Client sends: `protocol_version` (integer) and `client: { name, version }`.
- Core replies: `protocol_version` and `trail_version`.
- On a version mismatch core answers with an error saying which to update: the plugin or
  `trek`.

## Requests (client → core)

`open` and the moves answer with the session's view.

| Method              | Does                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `open(tour, args?)` | Load a saved tour by name and start at its overview; with `trek`'s |
|                     | arguments for the change as it is now, stale steps are marked      |
| `next`, `prev`      | Move one step in tour order, passing over context steps            |
| `into(target?)`     | Step into a call or a hop, the first not yet visited unless named  |
| `over`              | Step to the next step not inside the current step's calls          |
| `out`               | Step to the next step outside the current step's function          |
| `goto(step)`        | Jump to a step                                                     |

A move with nowhere to go answers with the view unchanged.

For the list of tours, each taking `trek`'s arguments for the change (none: the current
branch's):

| Method              | Answers                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `tours(args?)`      | Every saved tour (name, title, stops, likely-wrong flags) and where |
|                     | the change's tour stands: ready, stale, building, failed, missing   |
| `build(args?)`      | Starts the agent in `SRCTREK_AGENT` on the change's tour, or        |
|                     | updates it when stale; answers where it stands once started         |
| `log(tour, lines?)` | The end of a tour's build log                                       |

## The view

One of:

- `overview`: title, overview, trigger, outcome, step count.
- `step`: number and count, the absolute path (the user's own file when it's the tour's version,
  else the tour's copy, marked `tour_copy`), the file's path in the user's checkout (`own_path`, null
  without one), lines, kind, name, summary,
  details, flag, predicted values, the change's lines in the file, stale, the call stack back
  across every hop its caller waits on (hops marked) and what started it when it begins at a hop
  nobody waits on (`started_by`), the steps it can step into (each with the line making the
  call, from its evidence, or null, and whether its link is guessed), the context steps that explain it, notes, and where it came
  from (`came_from`: the earlier step, or the step a context step explains, with its stop
  number, whether the link is guessed, and the lines its evidence cites with paths to open), and
  where next leads (`next`: into one of its calls and from which line, across a hop, back to a
  caller, on to another step, or to the end).
- `end`: title, outcome, step count, and every flag in the tour, most severe first, each with its
  step and stop number.

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
| 7    | `build` with no `SRCTREK_AGENT` set                    |
| 8    | `trek`'s arguments don't name a change trek can read   |

## Definitions and tests

- Requests are validated in core against their definitions.
- Contract tests (`packages/serve/test/contract.test.ts`) drive a real `trek serve` over its
  pipes with a JSON-RPC client, as an editor does. Each editor's own client joins them,
  headless: `packages/serve/test/nvim.test.ts` drives the Neovim plugin against it.
