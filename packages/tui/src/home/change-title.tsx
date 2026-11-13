import { useTerminalDimensions } from "@opentui/react"
import type { ChangeSummary, ChangedRepoSummary, RangeHead } from "@srctrek/core"
import { count, fit } from "../ui/text"
import { useTones } from "../ui/theme"
import { TitleBar, titleRoom } from "../ui/title-bar"

// "feature/refunds", "feature/refunds + uncommitted", "pr 12".
function headLabel(head: RangeHead): string {
  if (head.kind === "branch") {
    return head.uncommitted ? `${head.name} + uncommitted` : head.name
  }

  return `${head.kind === "pull" ? "pr" : "mr"} ${head.number}`
}

// The head every changed repo shares, "feature/refunds", or none where they differ.
function sharedHead(changed: readonly ChangedRepoSummary[]): string | undefined {
  const heads = new Set(changed.map((repo) => headLabel(repo.head)))
  return heads.size === 1 ? [...heads][0] : undefined
}

/** What the change is: its branch or pull request, each repo's where they differ. */
function changeText(summary: ChangeSummary): string {
  if (summary.code) {
    return "code as it is"
  }

  const each = summary.changed.map((repo) => `${repo.repo} ${headLabel(repo.head)}`).join(" · ")
  return sharedHead(summary.changed) ?? each
}

// The repos by name, those it passes through after a "+"; a count where the change names them;
// none for a change in just the repo trek runs in.
function reposText(summary: ChangeSummary): string {
  if (summary.code) {
    return summary.unchanged.join(", ")
  }

  if (summary.changed.length === 1 && summary.unchanged.length === 0) {
    return ""
  }

  if (sharedHead(summary.changed) === undefined) {
    return count(summary.changed.length + summary.unchanged.length, "repo")
  }

  const passing = summary.unchanged.length === 0 ? "" : ` + ${summary.unchanged.join(", ")}`
  return `${summary.changed.map((repo) => repo.repo).join(", ")}${passing}`
}

// " since main" where every changed repo is a branch from the same base; a pull request's base
// is the host's.
function sinceText(changed: readonly ChangedRepoSummary[]): string {
  const bases = new Set(changed.map((repo) => repo.base))
  const onBranches = changed.every((repo) => repo.head.kind === "branch")

  return onBranches && bases.size === 1 ? ` since ${[...bases][0]}` : ""
}

/** Where the change is and how big: "web + api, worker · 9 commits since main", "3 commits since main". */
function sizeText(summary: ChangeSummary): string {
  const repos = reposText(summary)
  if (summary.code) {
    return repos
  }

  const commits = summary.changed.reduce((total, repo) => total + repo.commits, 0)
  const size = `${count(commits, "commit")}${sinceText(summary.changed)}`
  return repos === "" ? size : `${repos} · ${size}`
}

const PICKED = " · picked"
// Below this, the right side is left out rather than cut to a stub.
const MIN_SIZE_WIDTH = 12

// The bar's texts cut to a terminal `width` wide: the change gets its room first, and the size
// gives way, left out entirely below a stub's width.
function fitted(summary: ChangeSummary, picked: boolean, width: number) {
  const change = changeText(summary)
  const label = picked ? PICKED : ""
  const room = titleRoom(width) - label.length
  const sizeRoom = room - change.length - 2
  const size = sizeRoom < MIN_SIZE_WIDTH ? "" : fit(sizeText(summary), sizeRoom)

  return { change: fit(change, room - (size === "" ? 0 : size.length + 2)), label, size }
}

/**
 * The home screen's title bar: the change, marked when it's one picked rather than the user's own
 * branch, and where it is and its size on the right.
 */
export function ChangeTitleBar({
  summary,
  picked,
}: {
  summary: ChangeSummary | undefined
  picked: boolean
}) {
  const tones = useTones()
  const { width } = useTerminalDimensions()
  if (summary === undefined) {
    return <TitleBar />
  }

  const { change, label, size } = fitted(summary, picked, width)
  const left = (
    <span>
      <span>{change}</span>
      {label !== "" && <span fg={tones.dim}>{label}</span>}
    </span>
  )

  return <TitleBar left={left} right={size} />
}
