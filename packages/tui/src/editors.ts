import type { CliRenderer } from "@opentui/core"
import { type TrekEntry, firstStopPlace, loadTrek } from "@srctrek/core"
import { openInNeovim } from "./neovim"

/**
 * An editor trek can open a trek in: one with srctrek's plugin, stepping through the trek, or the
 * user's $EDITOR, opened at the trek's first stop.
 */
export type Editor = Readonly<{
  id: string
  label: string
  command: string
  steps: boolean
}>

// Editors with a plugin trek starts, by the command that runs them. VS Code and its forks join
// once the extension can take a trek from outside.
const WITH_PLUGIN: readonly Editor[] = [
  { id: "nvim", label: "Neovim", command: "nvim", steps: true },
]

type Env = Readonly<Record<string, string | undefined>>

// The user's $EDITOR, named by its program: "$EDITOR (vim)".
function fromEnv(env: Env): Editor[] {
  const command = env["EDITOR"]?.trim()
  if (command === undefined || command === "") {
    return []
  }

  const program = command.split(/\s+/)[0]?.split("/").at(-1) ?? command
  return [{ id: "$EDITOR", label: `$EDITOR (${program})`, command, steps: false }]
}

/** The editors on this machine that trek can open a trek in, those that step first. */
export function availableEditors(
  env: Env = process.env,
  onPath: (command: string) => boolean = (command) => Bun.which(command) !== null,
): Editor[] {
  return [...WITH_PLUGIN.filter((editor) => onPath(editor.command)), ...fromEnv(env)]
}

/**
 * Hands the terminal to the user's $EDITOR at a file's line, as "+line file", which terminal
 * editors take, and takes it back when the editor exits.
 */
export async function openAtLine(
  renderer: CliRenderer,
  command: string,
  path: string,
  line: number,
) {
  await renderer.suspend()

  const editor = Bun.spawn(["sh", "-c", `${command} "$@"`, "editor", `+${line}`, path], {
    stdio: ["inherit", "inherit", "inherit"],
  })
  await editor.exited

  await renderer.resume()
}

/**
 * Opens the trek in `editor`: stepping, in one with srctrek's plugin; else at its first stop. A
 * trek whose first stop can't be placed opens nothing.
 */
export async function openInEditor(
  renderer: CliRenderer,
  root: string,
  entry: TrekEntry,
  editor: Editor,
) {
  if (editor.steps) {
    await openInNeovim(renderer, entry.name)
    return
  }

  const place = await firstStopPlace(root, await loadTrek(entry.path)).catch(() => undefined)
  if (place !== undefined) {
    await openAtLine(renderer, editor.command, place.path, place.line)
  }
}
