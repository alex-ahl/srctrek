import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import type { BranchChoices, ChangeChoice, OpenPullRequest, TrekStatus } from "@srctrek/core"
import { useEffect, useMemo, useState } from "react"
import { type PickerNote, PickerList, useStatuses } from "./change-picker-list"
import { type PickerRow, pickerRows, pullRequestRows } from "./change-picker-rows"
import { Footer } from "./footer"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"
import { TITLE_SEPARATOR } from "./title-bar"

type Props = {
  // the change the home screen is about now, marked in the list, and the changes to choose from
  choice: ChangeChoice
  load: () => Promise<BranchChoices>
  pullRequests: () => Promise<OpenPullRequest[]>
  // where the trek of each change stands, filled in as each is worked out
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  onPick: (choice: ChangeChoice) => void
  onBack: () => void
  // the chosen row's background, when the terminal's colours are known
  tint: RGBA | undefined
}

const KEYS = [
  { key: "↑/↓", does: "choose" },
  { key: "enter", does: "review this" },
  { key: "esc", does: "keep current" },
]

// Rows as they load, or why they can't be listed.
type Loaded =
  { kind: "loading" } | { kind: "ready"; rows: PickerRow[] } | { kind: "failed"; why: string }

const NOTHING_YET: Loaded = { kind: "loading" }

/** Rows from `load`, made by `toRows` once it answers; the same rows each render until then. */
function useLoaded<T>(load: () => Promise<T>, toRows: (found: T) => PickerRow[]): Loaded {
  const [loaded, setLoaded] = useState<Loaded>(NOTHING_YET)
  useEffect(() => {
    void load().then(
      (found) => setLoaded({ kind: "ready", rows: toRows(found) }),
      (error: unknown) =>
        setLoaded({ kind: "failed", why: error instanceof Error ? error.message : String(error) }),
    )
    // toRows makes rows from what's found; only a new load asks again
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  return loaded
}

const rowsOf = (loaded: Loaded): readonly PickerRow[] =>
  loaded.kind === "ready" ? loaded.rows : []

// The pull requests' heading with nothing to pick under it yet: still asking, none, or why not.
function pullNote(pulls: Loaded): PickerNote | undefined {
  if (pulls.kind === "loading") {
    return { group: "PULL REQUESTS", text: "finding pull requests…", tone: "dim" }
  }

  if (pulls.kind === "failed") {
    return { group: "PULL REQUESTS", text: `✕ ${pulls.why}`, tone: "bad" }
  }

  return pulls.rows.length === 0
    ? { group: "PULL REQUESTS", text: "no open pull requests", tone: "dim" }
    : undefined
}

// The branches, then the pull requests; a pull request's rows are only offered once listed.
function useRows(props: Props) {
  const branches = useLoaded(props.load, pickerRows)
  const pulls = useLoaded(props.pullRequests, pullRequestRows)
  const rows = useMemo(() => [...rowsOf(branches), ...rowsOf(pulls)], [branches, pulls])

  return { branches, rows, note: pullNote(pulls) }
}

/**
 * Choosing the change trek is about: the user's own branch first, with or without what isn't
 * committed yet, then the repo's other branches, then its open pull requests. Opens with their own
 * branch selected, so going back to it is one key.
 */
export function ChangePicker(props: Props) {
  const tones = useTones()
  const { branches, rows, note } = useRows(props)
  const [chosen, setChosen] = useState(0)
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
        {branches.kind === "failed" ? (
          <text fg={tones.bad}>{`✕ ${branches.why}`}</text>
        ) : (
          <PickerList
            rows={rows}
            chosen={chosen}
            choice={props.choice}
            statuses={statuses}
            note={note}
            tint={props.tint}
          />
        )}
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
