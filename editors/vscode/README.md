# srctrek for VS Code

Steps through a srctrek tour in VS Code and its forks: the narration for each stop in the
sidebar, the tour's marks in the code, and step over, into, and out on the debugger's keys.
Requires `trek`.

## Installing

From a srctrek checkout:

```sh
bun run --cwd editors/vscode package
code --install-extension editors/vscode/dist/srctrek.vsix
```

The extension starts `trek serve` in the workspace folder, so `trek` must be on your `PATH`, or
set `srctrek.serveCommand` to `["<srctrek>/dist/trek", "serve"]`. VS Code started from the Dock
or Finder doesn't see your shell's `PATH`; there, set the full path.

## Stepping

- Open a tour with "Srctrek: Open Tour…", or click one under Tours in the srctrek sidebar (its
  icon is in the activity bar); its overview opens in a tab, with the keys and what the marks in
  the code mean.
- The sidebar's Stop view starts with the stop's narration, its details, its flag, and where
  `F8` goes next; below come the call stack, where it came from with the code each piece of
  evidence cites, its context code, and questions.
- The line above the step holds its actions: the stop and its flag open the Stop view,
  "context" scrolls it to the context code, and "next" steps on.
- In the code: a green or blue bar in the gutter beside each line the change adds or edits,
  predicted values at the ends of their lines (`name ≈ value`), and `→` on each line that makes
  a call the tour follows (`→?` when guessed).
- The end of the tour lists every flag, each a link to its stop.

| Key / command                | Action                                     |
| ---------------------------- | ------------------------------------------ |
| `F8` / `Shift+F8`            | Next / previous stop                       |
| `F10`                        | Step over                                  |
| `F11`                        | Step into the call on the cursor's line    |
| `Shift+F11`                  | Step out                                   |
| Srctrek: Show Current Stop   | Back to the stop after you've moved off it |
| Srctrek: Show Context        | Scroll the Stop view to the context code   |
| Srctrek: Show or Hide Values | Show or hide predicted values              |
| `Escape` on the end tab      | End the tour (also Srctrek: End the Tour)  |

The keys work while a tour is open and no debug session runs. On a Mac, the F-keys may need
`fn`, and `F11` shows the desktop unless that shortcut is turned off.

A step opens your own file when it's the version the tour describes. A file you've changed since
opens from the tour's copy, read-only.
