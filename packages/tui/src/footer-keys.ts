import type { TrekStatus } from "@srctrek/core"
import type { KeyHint } from "./footer"
import type { Row } from "./rows"
import { hasTrek } from "./states"

/** What b does: "build" a trek, "update" an out-of-date one, or "rebuild" one built with an
 * older guide or that isn't valid. */
export function buildVerb(status: TrekStatus | undefined): string {
  if (status?.kind === "stale") {
    return "update"
  }

  return status?.kind === "older-guide" || status?.kind === "unreadable" ? "rebuild" : "build"
}

/** What enter says it does for the selected row. */
export function enterLabel(row: Row | undefined): string {
  if (row?.kind === "proposal") {
    return "add to the repos list"
  }

  const buildsTrigger = row?.kind === "trigger" && !hasTrek(row.found.trek)

  return buildsTrigger ? "build its trek" : "open in Neovim"
}

type Offered = { build: string | undefined; log: boolean; dismiss: boolean }

/** The footer's keys, in the order a person reaches for them; only those that act are listed. */
export function footerKeys(enter: string, offered: Offered): KeyHint[] {
  return [
    { key: "↑/↓", does: "choose" },
    { key: "enter", does: enter },
    ...(offered.dismiss ? [{ key: "d", does: "dismiss" }] : []),
    ...(offered.build === undefined ? [] : [{ key: "b", does: offered.build }]),
    ...(offered.log ? [{ key: "l", does: "log" }] : []),
    { key: "q", does: "quit" },
  ]
}
