import { RGBA } from "@opentui/core"

/**
 * The terminal's own colours, so the screen follows its theme, dark or light: its default text,
 * and ANSI colours in the roles of the visual language.
 */
export const COLOUR = {
  text: RGBA.defaultForeground(),
  dim: RGBA.fromIndex(8),
  bad: RGBA.fromIndex(1),
  good: RGBA.fromIndex(2),
  warn: RGBA.fromIndex(3),
  busy: RGBA.fromIndex(4),
  accent: RGBA.fromIndex(6),
}

export type Colour = (typeof COLOUR)[keyof typeof COLOUR]
