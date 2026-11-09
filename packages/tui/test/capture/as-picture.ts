import { type CapturedFrame, type CapturedSpan, TextAttributes } from "@opentui/core"
import { type Palette, dimmed, shownColour } from "./palettes"

// Menlo at 14 points, as a terminal draws it: its cells are 8.43 by 17 pixels.
const FONT = "/System/Library/Fonts/Menlo.ttc"
const CELL_WIDTH = 8.43
const CELL_HEIGHT = 17

const mvgString = (text: string) => `'${text.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`

// The span's colours in the palette, swapped when inverse and faded halfway when dim.
function coloursOf(span: CapturedSpan, palette: Palette): { fg: string; bg: string } {
  const fg = shownColour(span.fg, "fg", palette)
  const bg = shownColour(span.bg, "bg", palette)
  const [front, back] = (span.attributes & TextAttributes.INVERSE) !== 0 ? [bg, fg] : [fg, bg]
  const faded = (span.attributes & TextAttributes.DIM) !== 0 ? dimmed(front, back) : front

  return { fg: faded, bg: back }
}

// One span's drawing: its background where it isn't the terminal's, then its text; bold is
// drawn with a stroke, as Menlo's bold face can't be picked out of its collection.
function spanDrawing(span: CapturedSpan, row: number, col: number, palette: Palette): string[] {
  const { fg, bg } = coloursOf(span, palette)
  const x = col * CELL_WIDTH
  const y = row * CELL_HEIGHT
  const background =
    bg === palette.bg
      ? []
      : [`fill '${bg}' rectangle ${x},${y} ${x + span.width * CELL_WIDTH},${y + CELL_HEIGHT - 1}`]
  if (span.text.trim() === "") {
    return background
  }

  // Each character in its own cell, so the text keeps to the grid whatever the font's advance.
  const bold = (span.attributes & TextAttributes.BOLD) !== 0
  const pen = `fill '${fg}' ${bold ? `stroke '${fg}' stroke-width 0.5` : "stroke none"}`
  const characters = Array.from(span.text).flatMap((character, i) =>
    character === " "
      ? []
      : [`text ${x + i * CELL_WIDTH},${y + CELL_HEIGHT - 4} ${mvgString(character)}`],
  )

  return [...background, pen, ...characters]
}

function drawing(frame: CapturedFrame, palette: Palette): string {
  const ops = frame.lines.flatMap((line, row) => {
    let col = 0
    return line.spans.flatMap((span) => {
      const drawn = spanDrawing(span, row, col, palette)
      col += span.width
      return drawn
    })
  })

  return [`font '${FONT}'`, "font-size 14", ...ops].join("\n")
}

/** Draws the screen in the palette's colours as a PNG at `path`, with ImageMagick. */
export async function savePicture(frame: CapturedFrame, palette: Palette, path: string) {
  const mvg = `${path}.mvg`
  await Bun.write(mvg, drawing(frame, palette))

  const size = `${Math.ceil(frame.cols * CELL_WIDTH)}x${frame.rows * CELL_HEIGHT}`
  const magick = Bun.spawn(["magick", "-size", size, `xc:${palette.bg}`, "-draw", `@${mvg}`, path])
  const code = await magick.exited
  await Bun.file(mvg).delete()
  if (code !== 0) {
    throw new Error(`magick couldn't draw ${path}`)
  }
}
