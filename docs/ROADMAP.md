# Roadmap

After version 1, in no fixed order. Version 1's scope is in `DECISIONS.md`.

## Tours

- **Producer tours:** the agent that wrote a change records its tour as it finishes.
- **Tours travel with the PR:** committed on the branch or attached to the PR.
- **Comparing tours:** a producer's and a reviewer's tour of the same change side by side;
  disagreements are where to look first.
- **Tours of existing code:** a scenario with no range, every step unchanged.

## Stepping

- **Watched values:** pin a variable and see its predicted value, with its unit, at every
  step it passes through, like a debugger's watch expressions.
- **Boundary cards:** on each hop, what the sender sends beside what the receiver expects
  (field, type, unit, required), with mismatches marked.
- **Unvisited changes:** after the trail, the changed lines no step covered.
- **Continue:** jump to the next changed step, or to the next high-severity flag.
- **Diff toggle:** a step's lines before and after the change, inline.
- **Route panel:** every step grouped by repo, with the current step and the hops marked;
  any step can be jumped to.

## Building

- Standalone builder: codetrail explores and calls a model API itself, with the provider
  chosen by the user, for CI and for users without an agent.

## Sources

- PR URLs from GitLab and other hosts.
- PR descriptions and linked issues, through the host's CLI (`gh`, `glab`).
- `--spec` files and URLs.

## Editors

- Following in VS Code and Cursor (`code -g`), Zed, and Sublime.
- Editor plugins: inline summaries, stepping from inside the editor. Each plugin renders
  core's stepping session; none holds stepping logic of its own.
- VS Code extension: steps revealed and highlighted with decorations, summaries as CodeLens,
  `uncertain` flags as diagnostics, changed lines from the built-in git gutter, steps and
  call stack in a tree view, progress in the status bar.
- Spike: a tour presented as a narrated debug session over the Debug Adapter Protocol, so
  any editor with a debugger UI gets stepping, the call stack, and a variables pane without
  a plugin of its own. Predicted values appear in a scope labeled as predicted. Spike it
  before writing per-editor plugins beyond Neovim.

## Front-ends

- Web GUI served by the same binary (`trail --gui`).

## Accuracy

- Recorded mode: tours from a real run (Debug Adapter Protocol, tracers, tests).
- Mixed tours: observed steps where something cheap could run, predicted elsewhere, with
  provenance on each value.
- tree-sitter or LSP call graphs.

## Learning

- Understanding map, drift alerts, quizzes.

## Shipping

- Release workflow: per-platform binaries built on native runners, with checksums.
- Install script; Homebrew tap; an npm package with per-platform binaries.
- macOS notarization; Windows builds.
- Versioning: release-please from Conventional Commits; semver covers the CLI, key
  bindings, the tour format, and the workspace file; 0.x until those settle.
