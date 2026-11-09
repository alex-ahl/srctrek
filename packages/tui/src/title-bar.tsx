import { TextAttributes } from "@opentui/core"
import type { ChangeSummary, ChangedRepoSummary, RangeHead } from "@srctrek/core"
import { COLOUR } from "./theme"
import { useTerminalDimensions } from "@opentui/react"
import { count, fit } from "./text"

// "feature/refunds", "feature/refunds + uncommitted", "pr 12".
function headLabel(head: RangeHead): string {
  if (head.kind === "branch") {
    return head.uncommitted ? `${head.name} + uncommitted` : head.name
  }

  return `${head.kind === "pull" ? "pr" : "mr"} ${head.number}`
}

// "web · main...feature/refunds", or "api · pr 12" for a pull request, whose base is the host's.
function changedText({ repo, base, head }: ChangedRepoSummary): string {
  return head.kind === "branch"
    ? `${repo} · ${base}...${headLabel(head)}`
    : `${repo} · ${headLabel(head)}`
}

/** What the change is: each changed repo's range, then the repos it passes through. */
function changeText(summary: ChangeSummary): string {
  if (summary.code) {
    return `${summary.unchanged.join(", ")} · code as it is`
  }

  const passing = summary.unchanged.length === 0 ? [] : [`+ ${summary.unchanged.join(", ")}`]

  return [...summary.changed.map(changedText), ...passing].join("  ")
}

/** How big the change is: "3 repos · 9 commits". */
function sizeText(summary: ChangeSummary): string {
  const repos = count(summary.changed.length + summary.unchanged.length, "repo")
  if (summary.code) {
    return repos
  }

  const commits = summary.changed.reduce((total, repo) => total + repo.commits, 0)
  return `${repos} · ${count(commits, "commit")}`
}

/** The top line: srctrek, the change on the left and its size on the right, ruled off below. */
export function TitleBar({ summary }: { summary: ChangeSummary | undefined }) {
  const { width } = useTerminalDimensions()
  const size = summary === undefined ? "" : sizeText(summary)
  // the change gives way to its size: the padding, "srctrek  ", and two spaces before the size
  const room = width - size.length - 13
  const change = summary === undefined ? "" : `  ${fit(changeText(summary), room)}`

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      border={["bottom"]}
      borderColor={COLOUR.dim}
      style={{ paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}
    >
      <text fg={COLOUR.text}>
        <span fg={COLOUR.accent} attributes={TextAttributes.BOLD}>
          srctrek
        </span>
        {change}
      </text>
      <text fg={COLOUR.dim}>{size}</text>
    </box>
  )
}
