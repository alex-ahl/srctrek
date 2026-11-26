import type { ChangeSummary } from "@srctrek/core"
import { changeParts } from "./line"
import { useTerminalDimensions } from "@opentui/react"
import { fit } from "../ui/text"
import { TitleBar, titleRoom } from "../ui/title-bar"
import { SEPARATOR } from "../ui/separator"

// The repo trek runs in, as the change names it first.
function hereOf(summary: ChangeSummary): string {
  return summary.changed[0]?.repo ?? summary.unchanged[0] ?? ""
}

// Between the repo on the left and the change on the right.
const GAP = 2

/**
 * A change's title bar: the repo on the left, and on the right the change, its branch or pull
 * request and how much is on it; cut to fit.
 */
export function ChangeTitleBar({ summary }: { summary: ChangeSummary | undefined }) {
  const { width } = useTerminalDimensions()
  if (summary === undefined) {
    return <TitleBar />
  }

  const here = hereOf(summary)
  const change = changeParts(summary)
    .map((part) => part.text)
    .join("")
    .replace(new RegExp(`^${SEPARATOR}`), "")
  return (
    <TitleBar
      left={<span>{here}</span>}
      right={fit(change, titleRoom(width) - here.length - GAP)}
    />
  )
}
