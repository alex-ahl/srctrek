# Product

## Who it's for

Developers who review or take over code they didn't write: changes made by AI agents, and
big features in codebases they don't know.

## The problem

- A change arrives as a flat list of files across one or more repos. Rebuilding the flow
  from that list — what triggers it, what runs next, where it ends — is the hard part.
- The usual way to learn a flow is to run it and debug it. For a multi-repo feature that
  means getting every project, its services, and its data working locally first.

## What it is

A debugger session for code you haven't run. `trail` takes a change — a git range or pull
requests, across one or more repos — picks one concrete example scenario, and follows it
from its trigger (a request, an event, a cron job, a command) to its outcome (a response,
a write, an emitted event) in execution order.

- **Drives your editor.** Each step moves your editor to its file and lines; `trail` is the
  controller beside it: step over, into, out, with a call stack.
- **Whole flow, change highlighted.** Unchanged code on the path is included and collapsed
  by default; changed code is where attention goes.
- **Across repos.** One trail crosses repos and async boundaries (HTTP calls, queues,
  events), and each step names its repo.
- **No setup.** Reads code and history from git, local or remote; runs nothing.
- **Checkable.** Every link from one step to the next cites the line that causes it.
  Predicted values are labeled as predicted; guessed links and risky spots are flagged.
- **Any editor, any agent.**

## What it is not

- Not a summary or a review bot. The developer steps through; nothing is concluded for them.
- Not a real debugger. Values and paths are predicted from reading code, not observed.
- Not tied to an editor, an agent, or a code host.
- Not a tool for review comments or approvals.
