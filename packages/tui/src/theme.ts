import { RGBA } from "@opentui/core"
import { createContext, useContext } from "react"

/** The terminal's own text colours, which the screen always follows: its default, and dim. */
export const COLOUR = {
  text: RGBA.defaultForeground(),
  dim: RGBA.fromIndex(8),
}

/** The roles colour plays on screen: how a state stands, the selection, and dim detail. */
export type Tone = "good" | "warn" | "bad" | "busy" | "accent" | "dim"

export type Tones = Readonly<Record<Tone, RGBA>>

/** The terminal's own ANSI colours, the bright ones, for when it doesn't say what it looks like. */
export const TERMINAL_TONES: Tones = {
  good: RGBA.fromIndex(10),
  warn: RGBA.fromIndex(11),
  bad: RGBA.fromIndex(9),
  busy: RGBA.fromIndex(12),
  accent: RGBA.fromIndex(14),
  dim: COLOUR.dim,
}

// Colours chosen to stay apart from each other, as themes often draw green and yellow close: one
// set for a dark background, deeper ones for a light background.
const DARK_TONES: Tones = {
  good: RGBA.fromHex("#8fcf7a"),
  warn: RGBA.fromHex("#e6c27a"),
  bad: RGBA.fromHex("#f2858a"),
  busy: RGBA.fromHex("#8fb5ff"),
  accent: RGBA.fromHex("#4fc1a8"),
  dim: COLOUR.dim,
}

const LIGHT_TONES: Tones = {
  good: RGBA.fromHex("#1a7f37"),
  warn: RGBA.fromHex("#9a6700"),
  bad: RGBA.fromHex("#cf222e"),
  busy: RGBA.fromHex("#0969da"),
  accent: RGBA.fromHex("#1b7c83"),
  dim: COLOUR.dim,
}

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))

// Relative luminance, as WCAG defines it, 0 for black to 1 for white.
function luminance(hex: string): number {
  const linear = channels(hex).map((value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const [r = 0, g = 0, b = 0] = linear

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The tones for a terminal with this background: the dark set on a dark one, else the light. */
export function tonesFor(background: string): Tones {
  return luminance(background) < 0.4 ? DARK_TONES : LIGHT_TONES
}

/** The tones the screen draws in; the terminal's own until it says what its background is. */
export const TonesContext = createContext<Tones>(TERMINAL_TONES)

export const useTones = () => useContext(TonesContext)

// How far the selected row's background moves from the terminal's background toward the accent.
const BAND = 0.18

/**
 * The selected row's background: the terminal's own background moved toward the accent of the
 * tones it gets, a soft tint of it, so it reads as a highlight on dark and light alike.
 */
export function bandFor(background: string): RGBA {
  const [accent, bg] = [tonesFor(background).accent.toInts(), channels(background)]
  const [r = 0, g = 0, b = 0] = bg.map((value, i) =>
    Math.round(value + ((accent[i] ?? value) - value) * BAND),
  )

  return RGBA.fromInts(r, g, b)
}
