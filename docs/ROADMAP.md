# Roadmap

After version 1, in no fixed order. Version 1's scope is in `DECISIONS.md`.

## Tours

- **Producer tours:** the agent that wrote a change records its tour as it finishes.
- **Tours travel with the PR:** committed on the branch or attached to the PR.
- **Comparing tours:** a producer's and a reviewer's tour of the same change side by side;
  disagreements are where to look first.
- **Tours of existing code:** a scenario with no range, every step unchanged.

## Building

- Standalone builder: codetrail explores and calls a model API itself, with the provider
  chosen by the user, for CI and for users without an agent.

## Sources

- PR URLs from GitLab and other hosts.
- PR descriptions and linked issues, through the host's CLI (`gh`, `glab`).
- `--spec` files and URLs.

## Editors

- Following in VS Code and Cursor (`code -g`), Zed, and Sublime.
- Editor plugins: inline summaries, stepping from inside the editor.

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
