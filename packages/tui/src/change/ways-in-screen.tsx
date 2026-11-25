import { useTerminalDimensions } from "@opentui/react"
import type { ChangeSummary, TriggerTrek } from "@srctrek/core"
import { useState } from "react"
import { PADDING } from "../ui/layout"
import { moveKeys, stepped } from "../ui/move"
import { keyAt, selectedIndex } from "../ui/selection"
import { ChangeFrame, useAsk } from "./frame"
import {
  type WaysInActions,
  WaysIn,
  wayKey,
  wayRows,
  waysGroups,
  waysHints,
  waysKeys,
} from "./ways-in"

type Props = {
  summary: ChangeSummary
  ways: readonly TriggerTrek[]
  actions: WaysInActions
  // finds the ways in again; absent when no agent is set
  find: (() => Promise<void>) | undefined
  // runs work a key started, for where things stand to be read again once it's under way
  run: (work: Promise<void>) => void
  back: () => void
}

/**
 * The code as it is, once its ways in are found: each with its trek's state and where it's found,
 * chosen with ↑/↓ and kept by its trigger as the list is read again, then the row that follows a
 * trigger the user names.
 */
export function WaysInScreen({ summary, ways, actions, find, run, back }: Props) {
  const { width } = useTerminalDimensions()
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const ask = useAsk()

  const rows = wayRows(ways)
  const selected = selectedIndex(rows, chosen, wayKey)
  const context = { row: rows[selected], actions, find, run, ask: ask.ask }
  const move = (by: number) => setChosen(keyAt(rows, stepped(selected, by, rows.length), wayKey))
  const keys = new Map([...waysKeys(context), ...moveKeys(move), ["escape", back], ["q", back]])

  return (
    <ChangeFrame
      summary={summary}
      keys={keys}
      hints={waysHints(context)}
      groups={waysGroups(context)}
      ask={ask}
    >
      <WaysIn rows={rows} selected={selected} width={width - 2 * PADDING} />
    </ChangeFrame>
  )
}
