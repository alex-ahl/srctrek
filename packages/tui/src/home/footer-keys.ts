import type { TrekStatus } from "@srctrek/core"
import { HELP_HINT, type KeyGroup } from "../ui/keys-help"
import type { KeyHint } from "../ui/footer"
import type { Row } from "./list/rows"
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

  if (row?.kind === "ways-in") {
    return "find ways in"
  }

  if (row?.kind === "change") {
    return "build its trek"
  }

  const buildsTrigger = row?.kind === "trigger" && !hasTrek(row.trek)

  if (buildsTrigger) {
    return "build its trek"
  }

  return "open"
}

type Offered = {
  build: string | undefined
  log: boolean
  stop: boolean
  dismiss: boolean
  // C picks another change, offered on your changes' rows
  choose: boolean
}

// What x does here: dismiss the selected proposal, else stop a build.
function xHint({ dismiss, stop }: Offered): KeyHint[] {
  if (dismiss) {
    return [{ key: "x", does: "dismiss" }]
  }

  return stop ? [{ key: "x", does: "stop" }] : []
}

/** The footer's keys, those that act on the selected row in the order a person reaches for them;
 * enter is left out where it does nothing, and ? lists the rest. */
export function footerKeys(enter: string | undefined, offered: Offered): KeyHint[] {
  return [
    ...(enter === undefined ? [] : [{ key: "enter", does: enter }]),
    ...(offered.build === undefined ? [] : [{ key: "b", does: offered.build }]),
    ...xHint(offered),
    ...(offered.log ? [{ key: "l", does: "builds" }] : []),
    ...(offered.choose ? [{ key: "C", does: "another change" }] : []),
    HELP_HINT,
  ]
}

/** Every key on the home screen, for the panel ? opens. */
export const HOME_GROUPS: readonly KeyGroup[] = [
  {
    title: "the selected row",
    keys: [
      { key: "enter", does: "a trek's page; add a proposed repo; build a way in's trek" },
      { key: "b", does: "build, update, or rebuild the change's trek; rebuild a way in's" },
      { key: "x", does: "stop a build; dismiss a proposed repo" },
      { key: "l", does: "a trek's builds" },
      { key: "↑/↓", does: "choose a row (also j/k)" },
    ],
  },
  {
    title: "screens",
    keys: [
      { key: "C", does: "pick another change" },
      { key: "E", does: "pick where treks are stepped" },
      { key: "S", does: "settings" },
    ],
  },
  { title: "leave", keys: [{ key: "q", does: "quit" }] },
]
