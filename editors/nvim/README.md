# srctrek for Neovim

Steps through a trek in Neovim: the narration above each stop's code, the call stack in
the winbar, and step over, into, and out, as in a debugger. Requires `trek` (see the
[main README](../../README.md)).

## Opening a trek

`trek`'s home screen opens a trek with `enter`, starting Neovim with this plugin and its own
`trek serve`. To open treks from your own Neovim, add this folder to the runtime path:

```lua
vim.opt.rtp:append("<srctrek>/editors/nvim")
-- with lazy.nvim, which resets the runtime path: { dir = "<srctrek>/editors/nvim" }
```

Then `:Trek <name>` opens a saved trek. It starts `trek serve` in Neovim's working directory, so
`trek` must be on your `PATH`, or set `vim.g.srctrek = { cmd = { "/path/to/trek", "serve" } }`.

## Stepping

The trek opens with an overview: what the change does, its trigger and outcome, its repos and
flags, and the keys. Then `]t` steps through it in execution order, and each stop shows:

- **The narration** on a band above the step's code: what happens here, why it matters for the
  scenario, and how it follows from the last stop. A likely-wrong flag sits under it; a risky
  or worth-knowing one, and where `]t` goes next (`next: into post, line 6`), end it.
- **The step's code**, tinted, with `▶` on its first line, `+` or `~` beside the lines the change
  touches, predicted values at the ends of their lines (always `≈`, as nothing runs), and `→` on
  each line that makes a call the trek follows; the one `]t` enters from is bold, and `→?` marks a
  call the trek matched only by name.
- **The winbar**: the stop number, "existing code" or "new file" when that's what the step is,
  "guessed link" when the trek couldn't prove how it got here, "context available" when it has
  context code, the repo and file, and the call stack, outermost first. A hop into another repo
  is marked `↯`; a hop nobody waits on, such as a queued message, starts a fresh stack and names
  what started it. The winbar says "trek's version" when the file is the trek's copy, and "away"
  once you've moved off the step.

| Key          | Command                   | Action                                           |
| ------------ | ------------------------- | ------------------------------------------------ |
| `]t` / `[t`  | `:TrekNext` / `:TrekPrev` | Next / previous stop                             |
| `<leader>tn` | `:TrekOver`               | Step over                                        |
| `<leader>ti` | `:TrekInto`               | Step into the call on the cursor's line          |
| `<leader>to` | `:TrekOut`                | Step out                                         |
| `<leader>tc` | `:TrekCurrent`            | Back to the current stop                         |
| `<leader>tx` | `:TrekContext`            | Context code (contracts, types), when available  |
| `<leader>tt` | `:TrekDetails`            | Details: where it came from, its evidence, flags |
| `<leader>tv` | `:TrekValues`             | Show or hide predicted values                    |
| `<leader>tq` | `:TrekQuit`               | End the trek                                     |

Details say which stop this one was reached from and show each line of evidence with its code;
enter on one opens it. The end of the trek lists every flag, most severe first; enter on one
goes to its stop.

A step opens your own file when it's the version the trek describes. A file you've changed since
opens from the trek's copy, read-only and with its diagnostics hidden.

## Configuring

Keys exist only while a trek is open; the mappings you had on them come back when it ends, and
each window the trek used goes back to the file and place you had. Change or turn off any key:

```lua
vim.g.srctrek = { keys = { next = "]w", previous = "[w", values = false } }
```

`keys = false` turns them all off, for mapping the commands yourself.

Each step fires `User SrctrekStep` with `{ path, shown, line, repo }`, for a file tree or your
own config to follow: `path` is the file in your project, `shown` the file the step opened.
