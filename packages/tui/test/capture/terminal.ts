import { type CapturedFrame, type CapturedSpan, RGBA, TextAttributes } from "@opentui/core"
import { Terminal, type IBufferCell } from "@xterm/headless"
import type { Palette } from "./palettes"
import { mkdtemp, open, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** Keys by name, as a person presses them; anything else is sent as typed. */
const KEYS: Readonly<Record<string, string>> = {
  enter: "\r",
  esc: "\x1b",
  up: "\x1b[A",
  down: "\x1b[B",
  space: " ",
  tab: "\t",
}

export type TerminalRun = Readonly<{
  command: string
  cwd: string
  width: number
  height: number
  // each sent after the screen has had time to draw; the screen is read after the last
  keys: readonly string[]
}>

// Long enough for the program to start, ask the terminal about itself, and draw.
const FIRST_DRAW_MS = 2000
const KEY_GAP_MS = 600
const QUIT_MS = 2000

const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`

// "rgb:1616/1818/1b1b": a colour as a terminal reports it, each channel in four hex digits.
const reported = (hex: string) =>
  `rgb:${[1, 3, 5].map((at) => hex.slice(at, at + 2).repeat(2)).join("/")}`

// The colour queries a program asks the terminal: one of its palette's colours (OSC 4), its
// default text (OSC 10), its default background (OSC 11).
// oxlint-disable-next-line no-control-regex -- terminal escape sequences are what it matches
const QUERY = /\x1b\](4;(\d+)|10|11);\?(?:\x07|\x1b\\)/g

/** What a terminal in `palette` answers to every colour query in `output`. */
export function colourAnswers(output: string, palette: Palette): string[] {
  return [...output.matchAll(QUERY)].flatMap(([, which, index]) => {
    if (which === "10" || which === "11") {
      const colour = which === "10" ? palette.fg : palette.bg
      return [`\x1b]${which};${reported(colour)}\x07`]
    }

    const colour = palette.ansi[Number(index)]
    return colour === undefined ? [] : [`\x1b]4;${index};${reported(colour)}\x07`]
  })
}

/**
 * Runs `command` in a pseudo-terminal of the given size, through macOS's `script`, as a terminal
 * in `palette` would: it answers the program's colour queries, presses the keys and then q, and
 * returns everything the program wrote. Its input comes from a FIFO this process keeps writing
 * to, through cat, as `script` needs a pipe and won't take the FIFO itself.
 */
export async function runInTerminal(run: TerminalRun, palette: Palette): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "trek-terminal-"))
  const fifo = join(dir, "input")
  Bun.spawnSync(["mkfifo", fifo])

  const inner = `stty cols ${run.width} rows ${run.height}; cd ${quoted(run.cwd)} && exec ${run.command}`
  const shell = Bun.spawn(
    ["sh", "-c", `cat < ${quoted(fifo)} | script -q /dev/null sh -c ${quoted(inner)}`],
    {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
      env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
    },
  )
  const input = await open(fifo, "w")
  const send = (text: string) => input.write(text)

  let output = ""
  let answered = 0
  const reading = (async () => {
    for await (const chunk of shell.stdout.pipeThrough(new TextDecoderStream())) {
      output += chunk
      const answers = colourAnswers(output, palette)
      await Promise.all(answers.slice(answered).map(send))
      answered = answers.length
    }
  })()

  await Bun.sleep(FIRST_DRAW_MS)
  for (const key of run.keys) {
    await send(KEYS[key] ?? key)
    await Bun.sleep(KEY_GAP_MS)
  }
  // the screen the keys leave: quitting comes after, and q is typed into a field that's open
  const left = output
  await send("q")

  // q can be taken by a prompt; ctrl-c always quits trek; a program past both is killed. Its
  // output may stay open in script's children, so it's read for a moment more, not until it ends.
  const exited = (ms: number) =>
    Promise.race([shell.exited.then(() => true), Bun.sleep(ms).then(() => false)])
  if (!(await exited(QUIT_MS))) {
    await send("\x03")
  }
  if (!(await exited(QUIT_MS))) {
    shell.kill()
  }
  await Promise.race([reading, Bun.sleep(QUIT_MS)])
  await input.close()
  await rm(dir, { recursive: true, force: true })

  return left
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
