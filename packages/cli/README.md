# @srctrek/cli

## What it is

The `trek` binary's entry point.

## What it does, and does not

Does: read `trek`'s arguments, resolve the change through core, and start the home screen;
say what's wrong with arguments it can't use and exit 1.

Does not: hold tour logic or draw anything. Core resolves, front-ends draw.

## Where it fits

Depends on `@srctrek/core` and the front-ends' entry points. Entry point:
`packages/cli/src/main.ts`, compiled by `bun run build`.

## Why a package of its own

Front-ends never import each other; the one place that picks and starts a front-end sits
above them all.
