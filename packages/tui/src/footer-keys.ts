import type { TrekStatus } from "@srctrek/core"
import type { Editor } from "./editors"
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

/** What enter says it does for the selected row; opening names the editor, once one is chosen. */
export function enterLabel(row: Row | undefined, editor: Editor | undefined): string {
  if (row?.kind === "proposal") {
    return "add to the repos list"
  }

  const buildsTrigger = row?.kind === "trigger" && !hasTrek(row.found.trek)

  if (buildsTrigger) {
    return "build its trek"
  }

  return editor === undefined ? "open, choosing an editor" : `open in ${editor.label}`
}

type Offered = { build: string | undefined; log: boolean; dismiss: boolean }

/** The footer's keys, in the order a person reaches for them; only those that act are listed, so
 * enter is left out where it does nothing. */
export function footerKeys(enter: string | undefined, offered: Offered): KeyHint[] {
  return [
    { key: "↑/↓", does: "choose" },
    ...(enter === undefined ? [] : [{ key: "enter", does: enter }]),
    ...(offered.dismiss ? [{ key: "d", does: "dismiss" }] : []),
    ...(offered.build === undefined ? [] : [{ key: "b", does: offered.build }]),
    ...(offered.log ? [{ key: "l", does: "log" }] : []),
    { key: "E", does: "editor" },
    { key: "S", does: "settings" },
    { key: "q", does: "quit" },
  ]
}
