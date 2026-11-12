import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import type { BranchChoices, ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import { type PickerRow, pickerRows, sameChoice } from "./change-picker-rows"
import { Footer } from "./footer"
import { statusBlock } from "./status-block"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"
import { TITLE_SEPARATOR } from "./title-bar"

type Props = {
  // the change the home screen is about now, marked in the list, and the changes to choose from
  choice: ChangeChoice
  load: () => Promise<BranchChoices>
  // where the trek of each change stands, filled in as each is worked out
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  onPick: (choice: ChangeChoice) => void
  onBack: () => void
  // the chosen row's background, when the terminal's colours are known
  tint: RGBA | undefined
}

// The same empty list each render, so the statuses aren't asked for again while loading.
const NO_ROWS: readonly PickerRow[] = []

const KEYS = [
  { key: "↑/↓", does: "choose" },
  { key: "enter", does: "review this" },
  { key: "esc", does: "keep current" },
]

// The repo's branches as they load, or why they can't be listed.
type Loaded =
  { kind: "loading" } | { kind: "ready"; rows: PickerRow[] } | { kind: "failed"; why: string }

function useRows(load: () => Promise<BranchChoices>): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" })
  useEffect(() => {
    void load().then(
      (choices) => setLoaded({ kind: "ready", rows: pickerRows(choices) }),
      (error: unknown) =>
        setLoaded({ kind: "failed", why: error instanceof Error ? error.message : String(error) }),
    )
  }, [load])

  return loaded
}

// Each row's trek status as it's worked out; one that can't be worked out is left blank.
function useStatuses(
  rows: readonly PickerRow[],
  status: (choice: ChangeChoice) => Promise<TrekStatus>,
): ReadonlyMap<string, TrekStatus> {
  const [found, setFound] = useState<ReadonlyMap<string, TrekStatus>>(new Map())
  useEffect(() => {
    let current = true
    for (const row of rows) {
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

const rowKey = (row: PickerRow) => JSON.stringify(row.choice)

// "● trek ready", "≠ trek stale", "○ no trek yet": in the words and colours the home screen uses.
function StatusView({ status }: { status: TrekStatus | undefined }) {
  const tones = useTones()
  if (status === undefined) {
    return null
  }

  const { symbol, state, tone } = statusBlock(status, undefined, false)
  return <span fg={tones[tone]}>{`  ${symbol} ${STATE_WORDS[state] ?? state}`}</span>
}

// The block's words read as the trek's state on a row; "ready" alone could be the branch.
const STATE_WORDS: Readonly<Record<string, string>> = {
  ready: "trek ready",
  stale: "trek stale",
}

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
        {row.label.padEnd(widths.name)}
      </span>
      <span fg={tones.dim}>{`  ${row.detail.padEnd(widths.detail)}`}</span>
      <StatusView status={status} />
    </text>
  )

  return selected && tint !== undefined ? <box style={{ backgroundColor: tint }}>{line}</box> : line
}

// The name and detail columns, as wide as their longest, so the statuses line up after them.
type Widths = Readonly<{ name: number; detail: number }>

function Rows({
  rows,
  chosen,
  choice,
  statuses,
  tint,
}: {
  rows: readonly PickerRow[]
  chosen: number
  choice: ChangeChoice
  statuses: ReadonlyMap<string, TrekStatus>
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const widths = {
    name: Math.max(...rows.map((row) => row.label.length)),
    detail: Math.max(...rows.map((row) => row.detail.length)),
  }

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {rows.map((row, index) => {
        const heading = index === 0 || rows[index - 1]?.group !== row.group
        return (
          <box key={`${row.group}:${row.label}`} flexDirection="column" style={{ flexShrink: 0 }}>
            {heading && index > 0 && <text fg={COLOUR.text}> </text>}
            {heading && <text fg={tones.dim}>{row.group}</text>}
            <RowView
              row={row}
              selected={index === chosen}
              current={sameChoice(row.choice, choice)}
              widths={widths}
              status={statuses.get(rowKey(row))}
              tint={tint}
            />
          </box>
        )
      })}
    </box>
  )
}

// What the body says while the branches load, if they can't be listed, or the list itself.
function Body({
  loaded,
  chosen,
  statuses,
  props,
}: {
  loaded: Loaded
  chosen: number
  statuses: ReadonlyMap<string, TrekStatus>
  props: Props
}) {
  const tones = useTones()
  if (loaded.kind === "loading") {
    return <text fg={tones.dim}>finding branches…</text>
  }

  if (loaded.kind === "failed") {
    return <text fg={tones.bad}>{`✕ ${loaded.why}`}</text>
  }

  return (
    <Rows
      rows={loaded.rows}
      chosen={chosen}
      choice={props.choice}
      statuses={statuses}
      tint={props.tint}
    />
  )
}

/**
 * Choosing the change trek is about: the user's own branch first, with or without what isn't
 * committed yet, then the repo's other branches. Opens with their own branch selected, so going
 * back to it is one key.
 */
export function ChangePicker(props: Props) {
  const tones = useTones()
  const loaded = useRows(props.load)
  const [chosen, setChosen] = useState(0)
  const rows = loaded.kind === "ready" ? loaded.rows : NO_ROWS
  const row = rows[chosen]
  const statuses = useStatuses(rows, props.status)

  // from the selection as it is, so keys pressed faster than the screen redraws each count
  const move = (by: number) =>
    setChosen((at) => Math.min(Math.max(at + by, 0), Math.max(rows.length - 1, 0)))
  const keyActions = new Map([
    ["escape", props.onBack],
    ["return", () => row !== undefined && props.onPick(row.choice)],
    ["down", () => move(1)],
    ["j", () => move(1)],
    ["up", () => move(-1)],
    ["k", () => move(-1)],
  ])
  useKeyboard((key) => keyActions.get(key.name)?.())

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <box
        border={["bottom"]}
        borderColor={tones.dim}
        style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
      >
        <text fg={COLOUR.text}>
          <span attributes={TextAttributes.BOLD}>srctrek</span>
          <span fg={tones.dim}>{`${TITLE_SEPARATOR}change`}</span>
        </text>
      </box>
      <box
        flexDirection="column"
        style={{
          flexGrow: 1,
          paddingTop: 1,
          paddingLeft: PADDING,
          paddingRight: PADDING,
          overflow: "hidden",
        }}
      >
        <Body loaded={loaded} chosen={chosen} statuses={statuses} props={props} />
      </box>
      {row !== undefined && (
        <box
          border={["top"]}
          borderColor={tones.dim}
          style={{ flexShrink: 0, paddingLeft: PADDING, paddingRight: PADDING }}
        >
          <text fg={COLOUR.text}>
            <span fg={tones.dim}>Opens: </span>
            {row.opens}
          </text>
        </box>
      )}
      <Footer keys={KEYS} shown="" />
    </box>
  )
}
