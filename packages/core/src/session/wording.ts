import type { TrekStep } from "../schema/trek"

// The phrases every front-end shows a stop with, worded here so they read the same everywhere.

type Place = Readonly<{ file: string; start_line: number; name: string | null }>

/** A step's place, short: its file's last two path segments and its line, handlers/refunds.ts:8. */
export function shortPlace(ref: Place): string {
  const short = ref.file.split("/").slice(-2).join("/")
  return `${short}:${String(ref.start_line)}`
}

function nameOrPlace(ref: Place): string {
  return ref.name ?? shortPlace(ref)
}

type Next = Readonly<{
  how: "into" | "hop" | "back" | "on" | "end"
  to: (Place & Readonly<{ repo: string }>) | null
  line: number | null
  // what carries a hop: "via the agent", "on a timer"
  through: string | null
}>

/** Where next goes from a step in `repo`, so the reader knows before pressing it. */
export function nextText(next: Next, repo: string): string {
  const { how, to, line } = next
  if (how === "end" || to === null) {
    return "next: the end of the trek"
  }

  const label = nameOrPlace(to)
  if (how === "into") {
    return `next: into ${label}${line === null ? "" : `, line ${String(line)}`}`
  }
  if (how === "hop") {
    // a hop names its repo only when it leaves this one
    const leaves = to.repo === repo ? "" : `${to.repo}: `
    const through = next.through === null ? "" : `${next.through} to `
    return `next: ↯ ${through}${leaves}${label}`
  }
  if (how === "back") {
    return `next: back to ${label}`
  }

  return `next: ${label}`
}

/** How a step relates to the one it came from, before that step's number: "Reached from". */
export function cameFromLabel(relation: "from" | "for", stepKind: TrekStep["kind"]): string {
  if (relation === "for") {
    return "Explains"
  }

  return stepKind === "hop" ? "Reached by a hop from" : "Reached from"
}
