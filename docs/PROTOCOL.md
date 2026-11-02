# Editor protocol

How editor plugins and the TUI talk to core. Status: designed, not implemented
(Milestone 4).

## Transport

- JSON-RPC 2.0 over stdio, each message framed with a `Content-Length` header, as in the
  Language Server Protocol.
- The client starts `trail serve` as a child process; one client per process.

## Handshake

The client's first request is `initialize`:

- Client sends: `protocol_version` (integer), client name and version, and what it can
  draw (`virtual_text`, `signs`, `popups`).
- Core replies: its `protocol_version` and `trail` version.
- On a version mismatch both sides stop and say which to update: the plugin or `trail`.

## Commands (client → core)

| Method                      | Does                                          |
| --------------------------- | --------------------------------------------- |
| `open(tour)`                | Load a tour and start a stepping session      |
| `next`, `prev`              | Move one step                                 |
| `into`, `out`               | Step into a call, or out to the caller        |
| `goto(step)`                | Jump to a step                                |
| `continue(kind)`            | Next changed step, or next high-severity flag |
| `ask(question, selection?)` | Ask about the current step                    |

## Notifications (core → client)

| Method           | Carries                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `step`           | Absolute path in the cached checkout, line range, summary, flag and |
|                  | severity, changed lines in the file, call stack, position (n of N)  |
| `answer`         | Question, answer, citations                                         |
| `build/progress` | Overview and steps as they arrive, validation errors                |

Payloads are ready to render: the client decides nothing beyond fitting text to its window.

## Definitions and tests

- Messages are defined in code in core, like the tour schema, and validated on both ends.
- Contract tests run each editor client headless against a real `trail serve` in CI.
