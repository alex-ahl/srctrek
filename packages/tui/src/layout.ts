import type { TrekStatus } from "@srctrek/core"

// A row takes three lines: its title, a line about it, and a gap.
const ROW_LINES = 3

// The log lines the status shows below its heading, while building or after a failure.
function logLines(status: TrekStatus): number {
  return status.kind === "building" || status.kind === "failed" ? status.logTail.length : 0
}

// Lines spent on anything but rows: the frame's border and padding, the footer, and the
// status with its gap (two lines, in case it wraps, plus any log lines).
function chromeLines(status: TrekStatus | undefined): number {
  const frameAndFooter = 5
  if (status === undefined) {
    return frameAndFooter
  }

  return frameAndFooter + 2 + logLines(status) + 1
}

/** How many rows fit on a screen `height` lines tall, with the status above them. */
export function rowsThatFit(height: number, status: TrekStatus | undefined): number {
  return Math.max(1, Math.floor((height - chromeLines(status)) / ROW_LINES))
}
