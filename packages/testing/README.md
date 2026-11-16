# @srctrek/testing

## What it is

What the tests of every package share: temporary folders, git repos to build changes in, and
saved treks to step through.

## What it does, and does not

Does: make temporary folders cleared on later runs; make repos, commits, branches, and stand-in
code hosts; save treks of small flows (`pay`, the showcase) into a repo; hold a complete saved
trek of a refund flow (`fixtures/refund-trek.json`).

Does not: hold a package's own test helpers, which stay in its own tests.

## Where it fits

Depends on `@srctrek/core`. Every package's tests, and the VS Code extension's, take it as a dev
dependency; `scripts/showcase-repo.ts` imports it by path.

## Why a package of its own

The helpers are shared across packages, so each imports them by name rather than reaching into
another package's test folder. Nothing ships it.
