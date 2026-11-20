import type { Severity } from "@srctrek/core"
import type { Tone } from "../ui/theme"

/** How a flag of each severity shows: its mark, its words, and its tone. */
export const FLAGS: Readonly<
  Record<Severity, Readonly<{ mark: string; words: string; tone: Tone }>>
> = {
  high: { mark: "⚠", words: "likely wrong", tone: "bad" },
  medium: { mark: "●", words: "risky", tone: "warn" },
  low: { mark: "●", words: "worth knowing", tone: "dim" },
}

/** "⚠ likely wrong". */
export const flagWords = (severity: Severity) => `${FLAGS[severity].mark} ${FLAGS[severity].words}`
