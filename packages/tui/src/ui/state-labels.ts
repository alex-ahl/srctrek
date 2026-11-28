import type { TrekState } from "@srctrek/core"
import type { Tone } from "./theme"

/** A state as every screen shows it: its symbol and word, and the tone they're drawn in. */
export type StateLabel = Readonly<{ symbol: string; state: string; tone: Tone }>

export const STATE_LABELS = {
  ready: { symbol: "●", state: "ready", tone: "good" },
  stale: { symbol: "≠", state: "stale", tone: "warn" },
  "older-guide": { symbol: "↻", state: "older guide", tone: "warn" },
  "newer-guide": { symbol: "↻", state: "newer guide", tone: "warn" },
  missing: { symbol: "○", state: "no trek yet", tone: "dim" },
  empty: { symbol: "○", state: "nothing to trek", tone: "dim" },
  building: { symbol: "◐", state: "building", tone: "busy" },
  failed: { symbol: "✕", state: "build failed", tone: "bad" },
  stopped: { symbol: "■", state: "stopped", tone: "dim" },
  unreadable: { symbol: "✕", state: "can't read", tone: "bad" },
  unreachable: { symbol: "✕", state: "can't open", tone: "bad" },
} as const satisfies Record<string, StateLabel>

const DONE_WORD: Readonly<Record<Extract<TrekState, { kind: "done" }>["why"], string>> = {
  merged: "merged",
  pushed: "pushed",
  gone: "branch gone",
  committed: "committed",
}

/** The symbol of a trek whose work has landed or gone. */
export const DONE_SYMBOL = "✓"

/** A trek whose work has landed or gone: "✓ merged", "✓ branch gone", "✓ committed". */
export function doneLabel(why: Extract<TrekState, { kind: "done" }>["why"]): StateLabel {
  return { symbol: DONE_SYMBOL, state: DONE_WORD[why], tone: "dim" }
}
