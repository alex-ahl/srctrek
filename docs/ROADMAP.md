# Roadmap

After version 1, in no fixed order. Version 1's scope is in `DECISIONS.md`.

## Treks

- **Producer treks:** the agent that wrote a change records its trek as it finishes.
- **Treks travel with the PR:** committed on the branch in .srctrek/treks, once treks use
  portable sources.
- **Comparing treks:** a producer's and a reviewer's trek of the same change side by side;
  disagreements are where to look first.

## Stepping

- **Watched values:** pin a variable and see its predicted value, with its unit, at every
  step it passes through, like a debugger's watch expressions.
- **Boundary cards:** on each hop, what the sender sends beside what the receiver expects
  (field, type, unit, required), with mismatches marked.
- **Unvisited changes:** after the trek, the changed lines no step covered.
- **Continue:** jump to the next changed step, or to the next high-severity flag.
- **Diff toggle:** a step's lines before and after the change, inline.
- **Route panel:** every step grouped by repo, with the current step and the hops marked;
  any step can be jumped to.
- **Choosing a trek in Neovim:** `:Trek` without a name lists the saved treks with their
  status in `vim.ui.select`, and `:Trek <Tab>` completes their names; until then treks are
  chosen in the terminal.

## Building

- Standalone builder: srctrek explores and calls a model API itself, with the provider
  chosen by the user, for CI and for users without an agent.

## Sources

- PR URLs from GitLab and other hosts.
- PR descriptions and linked issues, through the host's CLI (`gh`, `glab`).
- `--spec` files and URLs.
- Companion PRs found automatically from cross-repo links in PR descriptions ("Depends on
  api#12"), through the host's CLI.

## Front-ends

- TUI sidebar mode: narration, call stack, watched values, and boundary cards in a pane, for
  an editor kept free of inline text.
- `trek doctor`: agent CLI found and logged in, editor connection, git credentials, cache.
- **Editing settings as JSON:** a key in the terminal's settings opens the settings file in the
  user's editor, and settings reread it on return.
- **Workspace mode:** `trek` started in a folder of repos rather than in one: the landing page
  lists each repo with its own work, pull requests, and branches, and the treks of all of them;
  a trek that covers several repos listed once.
- Presenting: a trek walked through for a team, with large narration and the route map.
- Web GUI served by the same binary (`trek --gui`).
- **srctrek.nvim:** the Neovim plugin copied on each release to a repo of its own, installable by
  URL from plugin managers; its source stays in `editors/nvim/`.
- Several clients on one stepping session (the TUI's route map following the editor),
  through a local socket.

## Accuracy

- Recorded mode: treks from a real run (Debug Adapter Protocol, tracers, tests).
- Mixed treks: observed steps where something cheap could run, predicted elsewhere, with
  provenance on each value.
- tree-sitter or LSP call graphs.

## Learning

- Understanding map, drift alerts, quizzes.

## Shipping

- Release workflow: per-platform binaries built on native runners, with checksums.
- Install script; Homebrew tap; an npm package with per-platform binaries.
- macOS notarization; Windows builds.
- The Neovim plugin moves to its own repo once the editor protocol is versioned and stable
  and the plugin has its own tests in CI; until then, mirrored on release into its own repo
  for plugin managers.
- The VS Code extension published to both the VS Code Marketplace and Open VSX, so forks can
  install it.
- Versioning: release-please from Conventional Commits; semver covers the CLI, key
  bindings, the trek format, and `.srctrek/repos`; 0.x until those settle.
