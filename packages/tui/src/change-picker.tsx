import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import type {
  BranchChoices,
  ChangeChoice,
  NearbyCheckout,
  OpenPullRequest,
  RepoPick,
  TrekStatus,
} from "@srctrek/core"
import { useEffect, useMemo, useState } from "react"
import { type PickerItem, type PickerNote, PickerList, useStatuses } from "./change-picker-list"
import { type Ticked, opensWith, repoItems, tickedOf, toggled } from "./change-picker-repos"
import { type PickerRow, pickerRows, pullRequestRows, sameChange } from "./change-picker-rows"
import { choiceName } from "./opening-line"
import { Footer } from "./footer"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"
import { TITLE_SEPARATOR } from "./title-bar"

type Props = {
  // the change the home screen is about now, marked in the list, and the changes to choose from
  choice: ChangeChoice
  load: () => Promise<BranchChoices>
  pullRequests: () => Promise<OpenPullRequest[]>
  nearby: () => Promise<NearbyCheckout[]>
  // where the trek of each change stands, filled in as each is worked out
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  onPick: (choice: ChangeChoice) => void
  onBack: () => void
  // the chosen row's background, when the terminal's colours are known
  tint: RGBA | undefined
}

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

// The repos beside this one; none until they're found, or when they can't be.
function useCheckouts(nearby: () => Promise<NearbyCheckout[]>): readonly NearbyCheckout[] {
  const [found, setFound] = useState<readonly NearbyCheckout[]>([])
  useEffect(() => {
    void nearby().then(setFound, () => undefined)
  }, [nearby])

  return found
}

// The ticked repos in the order they're listed.
const picksOf = (ticked: Ticked, checkouts: readonly NearbyCheckout[]): RepoPick[] =>
  checkouts.flatMap((checkout) => {
    const pick = ticked.get(checkout.path)
    return pick === undefined ? [] : [pick]
  })

// What enter opens from a line: that change on a change's line, else the current one; both with
// the ticked repos.
function pickOf(
  item: PickerItem | undefined,
  current: ChangeChoice,
  repos: RepoPick[],
): ChangeChoice {
  const { repos: _ticked, ...change } = item?.kind === "change" ? item.row.choice : current
  return repos.length === 0 ? change : { ...change, repos }
}

// What a line opens, in words, for the line above the footer.
function opensOf(
  item: PickerItem | undefined,
  rows: readonly PickerRow[],
  current: ChangeChoice,
): string {
  if (item?.kind === "change") {
    return item.row.opens
  }

  return rows.find((row) => sameChange(row.choice, current))?.opens ?? choiceName(current)
}

// The keys for the line selected: space ticks a repo, enter opens the fold.
function keysFor(item: PickerItem | undefined) {
  const enter = item?.kind === "fold" ? "show" : "review this"
  const space =
    item?.kind === "repo"
      ? [{ key: "space", does: item.pick === undefined ? "add repo" : "remove repo" }]
      : []

  return [
    { key: "↑/↓", does: "choose" },
    { key: "enter", does: enter },
    ...space,
    { key: "esc", does: "keep current" },
  ]
}

/**
 * Choosing the change trek is about: the user's own branch first, with or without what isn't
 * committed yet, then the repo's other branches, its open pull requests, and the repos beside it to
 * tick and take along. Opens with their own branch selected, so going back to it is one key.
 */
export function ChangePicker(props: Props) {
  const tones = useTones()
  const { branches, rows, note } = useRows(props)
  const checkouts = useCheckouts(props.nearby)
  const [ticked, setTicked] = useState(() => tickedOf(props.choice.repos))
  const [foldOpen, setFoldOpen] = useState(false)
  const [chosen, setChosen] = useState(0)
  const statuses = useStatuses(rows, props.status)

  const items: PickerItem[] = [
    ...rows.map((row) => ({ kind: "change" as const, row })),
    ...repoItems(checkouts, ticked, foldOpen),
  ]
  const item = items[chosen]
  const repos = picksOf(ticked, checkouts)
  const opens = opensWith(opensOf(item, rows, props.choice), ticked, checkouts)

  // from the selection as it is, so keys pressed faster than the screen redraws each count
  const move = (by: number) =>
    setChosen((at) => Math.min(Math.max(at + by, 0), Math.max(items.length - 1, 0)))
  const enter = () =>
    item?.kind === "fold" ? setFoldOpen(true) : props.onPick(pickOf(item, props.choice, repos))
  const keyActions = new Map([
    ["escape", props.onBack],
    ["return", enter],
    ["space", () => item?.kind === "repo" && setTicked(toggled(ticked, item.checkout))],
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
            items={items}
            chosen={chosen}
            choice={props.choice}
            statuses={statuses}
            note={note}
            tint={props.tint}
          />
        )}
      </box>
      {item !== undefined && (
        <box
          border={["top"]}
          borderColor={tones.dim}
          style={{ flexShrink: 0, paddingLeft: PADDING, paddingRight: PADDING }}
        >
          <text fg={COLOUR.text}>
            <span fg={tones.dim}>Opens: </span>
            {opens}
          </text>
        </box>
      )}
      <Footer keys={keysFor(item)} shown="" />
    </box>
  )
}
