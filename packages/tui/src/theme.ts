import { RGBA } from "@opentui/core"

/**
 * The terminal's own colours, so the screen follows its theme, dark or light: its default text,
 * and ANSI colours in the roles of the visual language, the bright ones for the roles that should
 * stand out.
 */
export const COLOUR = {
  text: RGBA.defaultForeground(),
  dim: RGBA.fromIndex(8),
  bad: RGBA.fromIndex(9),
  good: RGBA.fromIndex(10),
  warn: RGBA.fromIndex(11),
  busy: RGBA.fromIndex(12),
  accent: RGBA.fromIndex(14),
}

export type Colour = (typeof COLOUR)[keyof typeof COLOUR]

// How far the selected row's background moves from the terminal's background toward its text.
const TINT = 0.12

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))

/**
 * The selected row's background: the terminal's own background moved a little toward its text,
 * so it reads as a highlight in a dark theme and a light one alike.
 */
export function tintOf(foreground: string, background: string): RGBA {
  const [fg, bg] = [channels(foreground), channels(background)]
  const [r = 0, g = 0, b = 0] = bg.map((value, i) =>
    Math.round(value + ((fg[i] ?? value) - value) * TINT),
  )

  return RGBA.fromInts(r, g, b)
}
