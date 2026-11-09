import { type CapturedFrame, type CapturedSpan, RGBA, TextAttributes } from "@opentui/core"
import { Terminal, type IBufferCell } from "@xterm/headless"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** Keys by name, as a person presses them; anything else is sent as typed. */
const KEYS: Readonly<Record<string, string>> = {
  enter: "\r",
  esc: "\x1b",
  up: "\x1b[A",
  down: "\x1b[B",
  space: " ",
}

export type TerminalRun = Readonly<{
  command: string
  cwd: string
  width: number
  height: number
  // each sent after the screen has had time to draw; the screen is read after the last
  keys: readonly string[]
}>

// Long enough for the program to start, find its terminal unanswered, and draw.
const FIRST_DRAW_MS = 2000
const KEY_GAP_MS = 600
const QUIT_MS = 2000

const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`

// printf's octal escapes for every byte, so any key survives the shell's quoting.
const printfOf = (text: string) =>
  `printf '${[...new TextEncoder().encode(text)].map((byte) => `\\${byte.toString(8).padStart(3, "0")}`).join("")}'`

// The keys as a shell pipeline's input: a pause for the first draw, each key after a gap, then q,
// which trek quits on.
function keyFeed(keys: readonly string[]): string {
  const presses = [...keys.map((key) => KEYS[key] ?? key), "q"]
  const steps = presses.map(
    (press, i) => `sleep ${(i === 0 ? FIRST_DRAW_MS : KEY_GAP_MS) / 1000}; ${printfOf(press)}`,
  )

  return `(${steps.join("; ")}; sleep ${QUIT_MS / 1000})`
}

/**
 * Runs `command` in a pseudo-terminal of the given size, through macOS's `script`, presses the
 * keys and then q, and returns everything it wrote to the terminal. `script` needs a real pipe
 * for its input, so the keys come from a shell pipeline rather than from this process.
 */
export async function runInTerminal(run: TerminalRun): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "trek-terminal-"))
  const transcript = join(dir, "out")
  const inner = `stty cols ${run.width} rows ${run.height}; cd ${quoted(run.cwd)} && exec ${run.command}`
  // -F writes each output to the transcript at once, so nothing is lost when the run ends
  const pipeline = `${keyFeed(run.keys)} | script -q -F ${quoted(transcript)} sh -c ${quoted(inner)}`
  const shell = Bun.spawn(["sh", "-c", pipeline], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
  })
  await shell.exited

  const output = await readFile(transcript, "utf8")
  await rm(dir, { recursive: true, force: true })

  return output
}

// A cell's colour as OpenTUI names it: the terminal's default, an ANSI colour, or RGB.
function colourOf(cell: IBufferCell, role: "fg" | "bg"): RGBA {
  const isDefault = role === "fg" ? cell.isFgDefault() : cell.isBgDefault()
  if (isDefault) {
    return role === "fg" ? RGBA.defaultForeground() : RGBA.defaultBackground()
  }

  const value = role === "fg" ? cell.getFgColor() : cell.getBgColor()
  const isPalette = role === "fg" ? cell.isFgPalette() : cell.isBgPalette()
  if (isPalette) {
    return RGBA.fromIndex(value)
  }

  return RGBA.fromInts((value >> 16) & 255, (value >> 8) & 255, value & 255)
}

function attributesOf(cell: IBufferCell): number {
  const flags: readonly (readonly [number, number])[] = [
    [cell.isBold(), TextAttributes.BOLD],
    [cell.isDim(), TextAttributes.DIM],
    [cell.isItalic(), TextAttributes.ITALIC],
    [cell.isUnderline(), TextAttributes.UNDERLINE],
    [cell.isInverse(), TextAttributes.INVERSE],
  ]

  return flags.reduce((bits, [set, bit]) => (set === 0 ? bits : bits | bit), 0)
}

const sameStyle = (a: CapturedSpan, b: CapturedSpan) =>
  a.fg.equals(b.fg) && a.bg.equals(b.bg) && a.attributes === b.attributes

// A row's cells as spans of one style each; a wide character's second cell is part of the first.
function rowSpans(terminal: Terminal, y: number): CapturedSpan[] {
  const line = terminal.buffer.active.getLine(y)
  const spans: CapturedSpan[] = []
  for (let x = 0; x < terminal.cols; x++) {
    const cell = line?.getCell(x)
    if (cell === undefined || cell.getWidth() === 0) {
      continue
    }

    const span = {
      text: cell.getChars() || " ",
      fg: colourOf(cell, "fg"),
      bg: colourOf(cell, "bg"),
      attributes: attributesOf(cell),
      width: cell.getWidth(),
    }
    const last = spans.at(-1)
    if (last !== undefined && sameStyle(last, span)) {
      spans[spans.length - 1] = {
        ...last,
        text: last.text + span.text,
        width: last.width + span.width,
      }
    } else {
      spans.push(span)
    }
  }

  return spans
}

// Leaving the alternate screen, as a full-screen program does when it quits.
const LEAVE_SCREEN = "\x1b[?1049l"

/**
 * The screen `output` shows on a terminal `width` by `height` just before the program left it,
 * played through a real emulator.
 */
export async function playOutput(
  output: string,
  width: number,
  height: number,
): Promise<CapturedFrame> {
  const left = output.lastIndexOf(LEAVE_SCREEN)
  const shown = left === -1 ? output : output.slice(0, left)

  const terminal = new Terminal({ cols: width, rows: height, allowProposedApi: true })
  await new Promise<void>((resolve) => terminal.write(shown, resolve))

  const lines = Array.from({ length: height }, (_, y) => ({ spans: rowSpans(terminal, y) }))
  terminal.dispose()

  return { cols: width, rows: height, cursor: [0, 0], lines }
}
