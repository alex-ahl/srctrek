import type { RGBA } from "@opentui/core"

/** A terminal's colours: its default text and background, and its 16 ANSI colours. */
export type Palette = Readonly<{ name: string; fg: string; bg: string; ansi: readonly string[] }>

export const DARK: Palette = {
  name: "dark",
  fg: "#d3d6da",
  bg: "#16181b",
  ansi: [
    "#2d3136",
    "#f2858a",
    "#8fcf7a",
    "#e6c27a",
    "#8fb5ff",
    "#d2a6ff",
    "#7fd3d0",
    "#d3d6da",
    "#7c838c",
    "#ff9ea2",
    "#a6e08f",
    "#f0d394",
    "#a9c6ff",
    "#e0bdff",
    "#9ae2df",
    "#ffffff",
  ],
}

export const LIGHT: Palette = {
  name: "light",
  fg: "#24292f",
  bg: "#ffffff",
  ansi: [
    "#24292f",
    "#cf222e",
    "#116329",
    "#7d4e00",
    "#0969da",
    "#8250df",
    "#1b7c83",
    "#6e7781",
    "#57606a",
    "#a40e26",
    "#1a7f37",
    "#633c01",
    "#218bff",
    "#a475f9",
    "#3192aa",
    "#8c959f",
  ],
}

export const PALETTES: readonly Palette[] = [DARK, LIGHT]

const ANSI_NAMES = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "bright black",
  "bright red",
  "bright green",
  "bright yellow",
  "bright blue",
  "bright magenta",
  "bright cyan",
  "bright white",
]

const hexOf = (rgb: readonly number[]) =>
  `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`

/**
 * The colour a cell shows in `palette`: an ANSI colour from the palette, the terminal's default
 * for its role, or a fixed colour as it is. A transparent colour shows the terminal's default.
 */
export function shownColour(colour: RGBA, role: "fg" | "bg", palette: Palette): string {
  if (colour.intent === "indexed" && colour.slot < palette.ansi.length) {
    return palette.ansi[colour.slot] ?? palette[role]
  }

  const [r, g, b, a] = colour.toInts()
  if (colour.intent === "default" || a === 0) {
    return palette[role]
  }

  return hexOf([r, g, b])
}

/** How the screen names a colour in text: its ANSI name, "default", or its hex value. */
export function colourName(colour: RGBA): string {
  if (colour.intent === "indexed") {
    return ANSI_NAMES[colour.slot] ?? `colour ${colour.slot}`
  }

  const [r, g, b, a] = colour.toInts()
  return colour.intent === "default" || a === 0 ? "default" : hexOf([r, g, b])
}

/** Halfway from `fg` to `bg`: how a terminal draws dim text. */
export function dimmed(fg: string, bg: string): string {
  const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
  const [from, to] = [channels(fg), channels(bg)]

  return hexOf(from.map((value, i) => Math.round((value + (to[i] ?? value)) / 2)))
}
