/** Columns between the screen's edge and its content, on either side. */
export const PADDING = 2

// The title bar and the footer, each a line with its rule, and the line above the list.
const CHROME_LINES = 5

/** How many lines of the list fit on a screen `height` lines tall, with `above` lines over it. */
export function listHeight(height: number, above = 0): number {
  return Math.max(1, height - CHROME_LINES - above)
}
