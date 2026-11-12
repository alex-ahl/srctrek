import { type RGBA, TextAttributes } from "@opentui/core"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import { type PickerGroup, type PickerRow, sameChoice } from "./change-picker-rows"
import { statusBlock } from "./status-block"
import { fit } from "./text"
import { COLOUR, type Tone, useTones } from "./theme"

/** A line under a heading that isn't a change to pick: still loading, none, or why not. */
export type PickerNote = Readonly<{ group: PickerGroup; text: string; tone: Tone }>

// A pull request's title can run long; past this, names are cut so the columns stay put.
const MAX_NAME_WIDTH = 44

const rowKey = (row: PickerRow) => JSON.stringify(row.choice)

// Working out a pull request's trek means fetching it first, too slow to do for each row.
const hasQuickStatus = (row: PickerRow) => row.choice.kind !== "pull-request"

/** Each row's trek status as it's worked out; one that can't be worked out is left blank. */
export function useStatuses(
  rows: readonly PickerRow[],
  status: (choice: ChangeChoice) => Promise<TrekStatus>,
): ReadonlyMap<string, TrekStatus> {
  const [found, setFound] = useState<ReadonlyMap<string, TrekStatus>>(new Map())
  useEffect(() => {
    let current = true
    for (const row of rows.filter(hasQuickStatus)) {
      void status(row.choice).then(
        (each) => current && setFound((known) => new Map(known).set(rowKey(row), each)),
        () => undefined,
      )
    }

    return () => {
      current = false
    }
  }, [rows, status])

  return found
}

// The block's words read as the trek's state on a row; "ready" alone could be the branch.
const STATE_WORDS: Readonly<Record<string, string>> = {
  ready: "trek ready",
  stale: "trek stale",
}

// "● trek ready", "≠ trek stale", "○ no trek yet": in the words and colours the home screen uses.
function StatusView({ status }: { status: TrekStatus | undefined }) {
  const tones = useTones()
  if (status === undefined) {
    return null
  }

  const { symbol, state, tone } = statusBlock(status, undefined, false)
  return <span fg={tones[tone]}>{`  ${symbol} ${STATE_WORDS[state] ?? state}`}</span>
}

// The name and detail columns, as wide as their longest, so the statuses line up after them.
type Widths = Readonly<{ name: number; detail: number }>

// One change to pick: the current one marked, names lined up, what it holds dimmed after.
function RowView({
  row,
  selected,
  current,
  widths,
  status,
  tint,
}: {
  row: PickerRow
  selected: boolean
  current: boolean
  widths: Widths
  status: TrekStatus | undefined
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const marked = selected && tint === undefined
  const line = (
    <text fg={COLOUR.text}>
      <span fg={tones.accent}>{marked ? "▶ " : "  "}</span>
      <span fg={tones.accent}>{current ? "● " : "  "}</span>
      <span {...(current ? { attributes: TextAttributes.BOLD } : {})}>
        {fit(row.label, widths.name).padEnd(widths.name)}
      </span>
      <span fg={tones.dim}>{`  ${row.detail.padEnd(widths.detail)}`}</span>
      <StatusView status={status} />
    </text>
  )

  return selected && tint !== undefined ? <box style={{ backgroundColor: tint }}>{line}</box> : line
}

function Heading({ group, first }: { group: PickerGroup; first: boolean }) {
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {!first && <text fg={COLOUR.text}> </text>}
      <text fg={tones.dim}>{group}</text>
    </box>
  )
}

/**
 * The changes to pick under their headings, the selected one on the tint (or marked, where the
 * terminal's colours aren't known), the current one marked with a dot; then a note under a
 * heading of its own, for a group with nothing to pick yet.
 */
export function PickerList({
  rows,
  chosen,
  choice,
  statuses,
  note,
  tint,
}: {
  rows: readonly PickerRow[]
  chosen: number
  choice: ChangeChoice
  statuses: ReadonlyMap<string, TrekStatus>
  note: PickerNote | undefined
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const widths = {
    name: Math.min(MAX_NAME_WIDTH, Math.max(...rows.map((row) => row.label.length))),
    detail: Math.max(...rows.map((row) => row.detail.length)),
  }

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {rows.map((row, index) => (
        <box key={rowKey(row)} flexDirection="column" style={{ flexShrink: 0 }}>
          {rows[index - 1]?.group !== row.group && (
            <Heading group={row.group} first={index === 0} />
          )}
          <RowView
            row={row}
            selected={index === chosen}
            current={sameChoice(row.choice, choice)}
            widths={widths}
            status={statuses.get(rowKey(row))}
            tint={tint}
          />
        </box>
      ))}
      {note !== undefined && <Heading group={note.group} first={rows.length === 0} />}
      {note !== undefined && <text fg={tones[note.tone]}>{`    ${note.text}`}</text>}
    </box>
  )
}
