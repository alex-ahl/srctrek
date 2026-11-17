import type { ChangeSummary } from "@srctrek/core"
import { useTones } from "../ui/theme"
import { TitleBar } from "../ui/title-bar"

// The repo trek runs in, as the change names it first.
function hereOf(summary: ChangeSummary): string {
  return summary.changed[0]?.repo ?? summary.unchanged[0] ?? ""
}

/**
 * The home screen's title bar: the repo, then what kind of thing is open there, a change or code
 * as it is. The block below says what it is in full.
 */
export function ChangeTitleBar({ summary }: { summary: ChangeSummary | undefined }) {
  const tones = useTones()
  if (summary === undefined) {
    return <TitleBar />
  }

  const kind = summary.code ? "code as it is" : "a change"
  const left = (
    <span>
      <span>{hereOf(summary)}</span>
      <span fg={tones.dim}>{" › "}</span>
      <span>{kind}</span>
    </span>
  )

  return <TitleBar left={left} />
}
