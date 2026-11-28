import { type ReactNode, useEffect, useState } from "react"
import type { Ask } from "../change/keys"
import type { KeyHint } from "../ui/footer"
import type { KeyGroup } from "../ui/keys-help"
import { preparedKey } from "../worked-out"
import type { Pick } from "./rows"
import { PADDING } from "../ui/layout"
import { useTones } from "../ui/theme"
import { useTurning } from "../ui/turning"

/** From this many columns, the selected change's screen is shown beside the list. */
export const SPLIT_FROM = 110

/**
 * The list's columns beside a change's screen, names and states: a quarter of the terminal,
 * from 40 up to 52, so a wide one shows a pull request's title whole.
 */
export const listWidth = (width: number) => Math.min(Math.max(40, Math.floor(width / 4)), 52)

// The rule between the list and the change, and the room after it.
const RULE = 1
const RULE_GAP = 2

/** How wide the change beside the list is drawn, on a terminal `width` wide. */
export const besideWidth = (width: number) => width - listWidth(width) - RULE - RULE_GAP - PADDING

/**
 * The selected change's screen beside the list: the key of the change it shows, its body, the
 * keys acting on it and their hints, its keys' group on `?`, and a question it asks in the
 * footer's place.
 */
export type Beside = Readonly<{
  key: string
  body: ReactNode
  keys: ReadonlyMap<string, () => void>
  hints: readonly KeyHint[]
  group: KeyGroup | undefined
  asking: Ask | undefined
  closeAsk: () => void
}>

/** The key of what's beside the list: a change, by the key it's worked out by, or a done trek. */
export const besideKey = (picked: Pick): string =>
  picked.kind === "trek" ? `trek ${picked.name}` : preparedKey(picked)

type Keys = ReadonlyMap<string, () => void>

// Beside the list, the change's keys work from it, enter among them; the page keeps its own, q
// quitting, and the change's way back goes nowhere, there being nowhere to go back to.
function splitKeys(page: Keys, change: Keys | undefined): Keys {
  const theirs = [...(change ?? [])].filter(([key]) => key !== "escape" && key !== "q")
  const ours = [...page].filter(([key]) => key !== "return")
  return new Map([...theirs, ...ours])
}

/** The page as it's laid out: the list alone, or beside the selected change's screen. */
export type Split = Readonly<{
  split: boolean
  listWidth: number | undefined
  pane: ReactNode
  keysWith: (page: Keys) => Keys
  hints: readonly KeyHint[] | undefined
  group: KeyGroup | undefined
  // the change beside the list while it asks a question in the footer's place
  asker: Beside | undefined
  // on a view, where letters narrow it: enter, and its hint; the change's beside the list
  enterWith: (open: () => void) => () => void
  enterHint: readonly KeyHint[]
}>

const LIST_ALONE: Split = {
  split: false,
  listWidth: undefined,
  pane: undefined,
  keysWith: (page) => page,
  hints: undefined,
  group: undefined,
  asker: undefined,
  enterWith: (open) => open,
  enterHint: [{ key: "enter", does: "open" }],
}

// What the change beside the list brings while it's the one selected: its keys, their hints and
// group, and a question it asks; none of them while the one selected is worked out, enter doing
// nothing meanwhile.
const actingOn = (beside: Beside | undefined) => ({
  keysWith: (page: Keys) => splitKeys(page, beside?.keys),
  hints: beside?.hints ?? [],
  group: beside?.group,
  asker: beside?.asking === undefined ? undefined : beside,
  enterWith: () => () => beside?.keys.get("return")?.(),
  enterHint: (beside?.hints ?? []).filter((hint) => hint.key === "enter"),
})

// Beside the selected change's screen: the list at its width, and the change while it's the one
// selected; else the change shown last, while the one selected, `key`, is worked out.
function besideChange(key: string | undefined, given: Beside | undefined, width: number): Split {
  const beside = given?.key === key ? given : undefined
  return {
    split: true,
    listWidth: listWidth(width),
    pane: <BesidePane beside={given} waiting={beside === undefined ? key : undefined} />,
    ...actingOn(beside),
  }
}

/**
 * The page's layout: where it's split, the list beside the screen of the change `picked` opens,
 * or of the done trek it is, as it's shown once ready; else the list alone.
 */
export const splitFor = (
  split: Readonly<{ beside: Beside | undefined }> | undefined,
  picked: Pick | undefined,
  width: number,
): Split =>
  split === undefined
    ? LIST_ALONE
    : besideChange(picked === undefined ? undefined : besideKey(picked), split.beside, width)

// How long the change last shown stays while the one selected is worked out, before it says so.
const OPENING_SHOWN_MS = 300

/** Whether the change `waiting` names has been waited for `ms`; false while none is. */
function useWaitedFor(waiting: string | undefined, ms: number): boolean {
  const [waited, setWaited] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (waiting === undefined) {
      return undefined
    }

    const timer = setTimeout(() => setWaited(waiting), ms)
    return () => clearTimeout(timer)
  }, [waiting, ms])

  return waiting !== undefined && waited === waiting
}

/**
 * The right side: the selected change's screen; while another is being worked out, the one shown
 * last, then, once that takes a while, that it's opening.
 */
export function BesidePane({
  beside,
  waiting,
}: {
  beside: Beside | undefined
  // the key of the change selected while it's still being worked out
  waiting: string | undefined
}) {
  const tones = useTones()
  const opening = useWaitedFor(waiting, OPENING_SHOWN_MS)
  const turning = useTurning(opening)
  const shown = opening || beside === undefined ? undefined : beside.body

  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={tones.dim}
      style={{ flexGrow: 1, paddingLeft: RULE_GAP, overflow: "hidden" }}
    >
      {shown ?? <text fg={tones.dim}>{opening ? `${turning} opening…` : ""}</text>}
    </box>
  )
}
