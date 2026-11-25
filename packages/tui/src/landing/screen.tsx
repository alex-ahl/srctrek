import type { KeyEvent, RGBA } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { NearbyCheckout, RepoBranches, RepoPick } from "@srctrek/core"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { LandingList } from "./list"
import { choiceKey, rowKey } from "./statuses"
import { type Ticked, toggled } from "./repos"
import type { DropView } from "./drop-view"
import { RepoSheet, sheetHeight } from "./sheet"
import { keyAt, selectedIndex } from "../ui/selection"
import { useSheet } from "./use-sheet"
import { type Pending, choiceName } from "../opening"
import { typed, useDrop } from "./use-drop"
import { type LandingSources, useRows } from "./use-rows"
import type { LandingRow, Pick } from "./rows"
import { Footer, type KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { useTones } from "../ui/theme"
import { moveKeys, shifted, stepped } from "../ui/move"
import { useNow } from "../ui/clock"
import { TitleBar } from "../ui/title-bar"
import { useTurning } from "../ui/turning"

type Props = LandingSources & {
  // the branches of a repo beside this one, by its path, and fetching it on the user's word
  repoBranches: (path: string) => Promise<RepoBranches>
  fetchRepo: (path: string) => Promise<void>
  // a change picked here that's being worked out, or why it couldn't be
  opening?: Pending | undefined
  onPick: (pick: Pick) => void
  // the selection resting on a change, what it would open, for it to be worked out ahead
  onRest?: ((pick: Pick) => void) | undefined
  onSettings: () => void
  onQuit: () => void
  // the chosen row's background, when the terminal's colours are known
  tint: RGBA | undefined
}

// The title bar, the line above the list, and the footer, each with its rule; and a notice, with
// its rule, while one is shown.
const chromeLines = (notice: string | undefined) => (notice === undefined ? 5 : 7)

// The row of the change being opened, by its key.
const openingKey = (opening: Pending | undefined) =>
  opening?.kind === "opening" ? choiceKey(opening.choice) : undefined

/**
 * Why a change picked here couldn't be opened, shown once: until the next key, which `seen` is
 * told of.
 */
function useNotice(opening: Pending | undefined) {
  const [seen, setSeen] = useState<Pending | undefined>(undefined)
  const failed = opening?.kind === "failed" && opening !== seen ? opening : undefined
  return {
    text:
      failed === undefined
        ? undefined
        : `✕ couldn't open ${choiceName(failed.choice)}: ${failed.why}`,
    seen: () => setSeen(opening),
  }
}

const DROP_KEYS = [
  { key: "type", does: "narrow" },
  { key: "enter", does: "take" },
  { key: "←/esc", does: "close" },
]

// The ticked repos in the order they're listed.
const picksOf = (ticked: Ticked, checkouts: readonly NearbyCheckout[]): RepoPick[] =>
  checkouts.flatMap((checkout) => {
    const pick = ticked.get(checkout.path)
    return pick === undefined ? [] : [pick]
  })

// The names of the repos added, the first two and a count of the rest: "api, docs +1".
function addedNames(ticked: Ticked, checkouts: readonly NearbyCheckout[]): string | undefined {
  const names = checkouts.filter((checkout) => ticked.has(checkout.path)).map(({ name }) => name)
  if (names.length === 0) {
    return undefined
  }

  const rest = names.length - 2
  return rest > 0 ? `${names.slice(0, 2).join(", ")} +${String(rest)}` : names.join(", ")
}

// How long the selection stays on a change before what it opens is worked out ahead.
const REST_MS = 150

/** Tells `onRest` what the selection would open once it has stayed on it a moment. */
function useResting(
  active: boolean,
  pick: Pick | undefined,
  onRest: ((pick: Pick) => void) | undefined,
) {
  // behind another screen, the page's selection isn't where the user is looking
  const key = !active || pick === undefined ? undefined : JSON.stringify(pick)
  const latest = useRef({ pick, onRest })
  useEffect(() => {
    latest.current = { pick, onRest }
  })

  useEffect(() => {
    if (key === undefined) {
      return undefined
    }

    const timer = setTimeout(() => {
      const { pick: resting, onRest: tell } = latest.current
      if (resting !== undefined) {
        tell?.(resting)
      }
    }, REST_MS)
    return () => clearTimeout(timer)
  }, [key])
}

// The page's keys, taken only while it's in front.
function useLandingKeys(active: boolean, handle: (key: KeyEvent) => void) {
  useKeyboard((key) => {
    if (active) {
      handle(key)
    }
  })
}

// What enter opens from a change's line, with the ticked repos when it's a change.
function pickOf(row: LandingRow, repos: RepoPick[]): Pick {
  if (row.choice.kind === "trek") {
    return row.choice
  }

  return repos.length === 0 ? row.choice : { ...row.choice, repos }
}

/**
 * What the page shows: the changes, or, on a view of their own, the treks whose work is done, the
 * other pull requests, or the other branches.
 */
type View = "changes" | "done" | "pulls" | "branches"

/** What a view is narrowed to: what's typed, and how many of its rows hold it. */
type Narrowed = Readonly<{ query: string; shown: number; of: number }>

/** How many each view besides the changes lists, for the keys that open them. */
type Besides = Readonly<{ done: number; pulls: number; branches: number }>

// A key that opens a view, while it has something to list: "p: 28 pull requests".
const viewKey = (key: string, n: number, one: string, many: string): KeyHint[] =>
  n === 0 ? [] : [{ key, does: `${n} ${n === 1 ? one : many}` }]

// The keys for the list's line selected, a to add repos, and the views besides it.
function listKeys(besides: Besides): KeyHint[] {
  return [
    { key: "enter", does: "open" },
    { key: "a", does: "add repos" },
    ...viewKey("p", besides.pulls, "pull request", "pull requests"),
    ...viewKey("B", besides.branches, "branch", "branches"),
    ...viewKey("d", besides.done, "done trek", "done treks"),
    HELP_HINT,
  ]
}

// The page's keys: the sheet's while it's open, else a view's or the changes'.
function pageKeys(
  sheet: readonly KeyHint[] | undefined,
  view: View,
  besides: Besides,
  query: string,
): readonly KeyHint[] {
  if (sheet !== undefined) {
    return sheet
  }

  return view === "changes" ? listKeys(besides) : viewKeys(query)
}

// A view's keys: letters narrow it, so esc clears what's typed before it goes back.
const viewKeys = (query: string): readonly KeyHint[] => [
  { key: "type", does: "narrow" },
  { key: "enter", does: "open" },
  { key: "esc", does: query === "" ? "back" : "clear" },
]

// A row whose name holds what's typed, whatever its case: a pull request by its number or title.
const narrowedTo = (rows: readonly LandingRow[], query: string) =>
  rows.filter((row) => row.label.toLowerCase().includes(query.toLowerCase()))

// The footer: a repo's open branches' keys while they're open, else the selected line's.
const footerOf = (dropOpen: boolean, line: readonly KeyHint[]): readonly KeyHint[] =>
  dropOpen ? DROP_KEYS : line

const GROUPS: readonly KeyGroup[] = [
  {
    title: "the selected line",
    keys: [
      { key: "enter", does: "open the change" },
      { key: "↑/↓", does: "choose a line (also j/k)" },
    ],
  },
  {
    title: "repos to go along",
    keys: [
      { key: "a", does: "add repos to the change" },
      { key: "space", does: "add a repo, or remove it" },
      { key: "→", does: "a repo's branches" },
      { key: "type", does: "to narrow the repos by name or path" },
      { key: "esc", does: "clear what's typed, or done" },
    ],
  },
  {
    title: "screens",
    keys: [
      { key: "p", does: "the other pull requests" },
      { key: "B", does: "the other branches" },
      { key: "d", does: "the treks whose work is done" },
      { key: "S", does: "settings" },
    ],
  },
  { title: "leave", keys: [{ key: "q", does: "quit" }] },
]

// At most half the room below the title bar goes to the sheet, so the changes stay in view.
const sheetMost = (room: number) => Math.floor(room / 2)

// A repo's branches as they're drawn under its row, while they're open.
function dropView(
  drop: ReturnType<typeof useDrop>,
  ticked: Ticked,
  now: Date,
): DropView | undefined {
  const open = drop.drop
  if (open === undefined) {
    return undefined
  }

  return { drop: open, rows: drop.rows, problem: drop.problem, pick: ticked.get(open.path), now }
}

/**
 * Every change there is to look at, each with its trek's state: the user's own work, the pull
 * requests, the repo's other branches, and code as it is, with the treks whose work is done on a
 * view of their own; the repos beside it to tick and take along in a sheet slid up over the list.
 * Opens on the user's own branch.
 */
export function Landing(props: Props) {
  const { height } = useTerminalDimensions()
  const {
    settled,
    statuses,
    builtAt,
    branches,
    rows,
    otherPulls,
    otherBranches,
    done,
    nearby,
    note,
  } = useRows(props)
  const [ticked, setTicked] = useState<Ticked>(new Map())
  // a view of its own shown in the changes' place
  const [view, setView] = useState<View>("changes")
  // what's typed to narrow a view of its own
  const [query, setQuery] = useState("")
  // the selected line by its key, so it stays put as rows load above it
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const active = props.active !== false
  const checkouts = nearby
  const help = useKeysHelp()
  // what branches' ages are measured from
  const now = useNow()

  const lists: Readonly<Record<View, readonly LandingRow[]>> = {
    changes: rows,
    done,
    pulls: otherPulls,
    branches: otherBranches,
  }
  const items = view === "changes" ? rows : narrowedTo(lists[view], query)
  const besides = { done: done.length, pulls: otherPulls.length, branches: otherBranches.length }
  const selected = selectedIndex(items, chosen, rowKey)
  const item = items[selected]
  const repos = picksOf(ticked, checkouts)
  // what enter opens from the selected line, when it's a change's
  const picked = item === undefined ? undefined : pickOf(item, repos)
  useResting(active, picked, props.onRest)
  const drop = useDrop(props.repoBranches, props.fetchRepo, (pick) =>
    setTicked(new Map(ticked).set(pick.path, pick)),
  )
  const sheet = useSheet(
    checkouts,
    ticked,
    (checkout) => setTicked(toggled(ticked, checkout)),
    drop.open,
  )
  const notice = useNotice(props.opening)
  const shownDrop = dropView(drop, ticked, now)

  const move = (by: number) => setChosen(keyAt(items, stepped(selected, by, items.length), rowKey))
  const enter = () => picked !== undefined && props.onPick(picked)
  // switching views starts at the top of what's shown
  const show = (shown: View) => {
    setView(shown)
    setChosen(undefined)
    setQuery("")
  }
  const viewActions = new Map([
    ["return", enter],
    ["escape", () => (query === "" ? show("changes") : setQuery(""))],
    ["backspace", () => setQuery((was) => was.slice(0, -1))],
    ["down", () => move(1)],
    ["up", () => move(-1)],
  ])
  // On a view of its own, letters are typed, narrowing it, as in the sheet.
  const typeOnView = (key: KeyEvent) => {
    const action = viewActions.get(key.name)
    if (action !== undefined) {
      action()
    } else if (typed(key)) {
      setQuery((was) => was + key.sequence)
    }
  }
  const keyActions = new Map([
    ["return", enter],
    ["p", () => otherPulls.length > 0 && show("pulls")],
    ["B", () => otherBranches.length > 0 && show("branches")],
    ["d", () => done.length > 0 && show("done")],
    ["a", sheet.show],
    ["S", props.onSettings],
    ["q", props.onQuit],
    ["?", help.show],
    ...moveKeys(move),
  ])
  // While a repo's branches are open, keys go there; else while the sheet is, there.
  useLandingKeys(
    active,
    help.guard((key) => {
      notice.seen()
      if (drop.key(key) || sheet.key(key)) {
        return
      }

      if (view === "changes") {
        keyActions.get(shifted(key))?.()
      } else {
        typeOnView(key)
      }
    }),
  )

  const room = height - chromeLines(notice.text)
  const sheetLines = sheet.open ? sheetHeight(sheet.items, shownDrop, sheetMost(room)) : 0

  return (
    <LandingView
      active={active}
      list={
        settled ? (
          <LandingList
            items={items}
            chosen={selected}
            statuses={statuses}
            builtAt={builtAt}
            note={view === "changes" ? note : undefined}
            muted={sheet.open}
            tint={props.tint}
            opening={openingKey(props.opening)}
            height={room - sheetLines}
          />
        ) : undefined
      }
      sheet={
        sheet.open ? (
          <RepoSheet
            items={sheet.items}
            chosen={sheet.at}
            added={ticked.size}
            query={sheet.query}
            drop={shownDrop}
            tint={props.tint}
            height={sheetLines}
          />
        ) : undefined
      }
      added={addedNames(ticked, checkouts)}
      base={branches.kind === "ready" ? branches.found.base : undefined}
      view={view}
      narrowed={{ query, shown: items.length, of: lists[view].length }}
      failed={branches.kind === "failed" ? branches.why : undefined}
      notice={notice.text}
      footer={footerOf(
        drop.drop !== undefined,
        help.footer(pageKeys(sheet.open ? sheet.keys : undefined, view, besides, query)),
      )}
      help={help.open}
    />
  )
}

// How long the page reads before it says it's reading, so a quick read never flashes it.
const READING_SHOWN_MS = 150

// What the page says while it's still reading, once that takes a while: the busy symbol turning.
function Reading() {
  const tones = useTones()
  const [shown, setShown] = useState(false)
  const turning = useTurning(shown)
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), READING_SHOWN_MS)
    return () => clearTimeout(timer)
  }, [])

  return shown ? <text fg={tones.dim}>{`${turning} reading this repo…`}</text> : null
}

// What the title bar says the page shows: a view of its own, or what the changes are measured
// against.
const VIEW_TITLES: Readonly<Record<Exclude<View, "changes">, string>> = {
  done: "done treks",
  pulls: "pull requests",
  branches: "branches",
}

// A view's title, and once something's typed, how many of its rows hold it and what it is:
// "pull requests · 1 of 2  / cache▏".
function titleOf(view: View, base: string | undefined, narrowed: Narrowed): ReactNode {
  if (view !== "changes") {
    const { query, shown, of } = narrowed
    return query === ""
      ? VIEW_TITLES[view]
      : `${VIEW_TITLES[view]} · ${shown} of ${of}  / ${query}▏`
  }

  return base === undefined ? undefined : <Against base={base} />
}

// What the changes are measured against, named once in the title bar: "against main".
function Against({ base }: { base: string }) {
  const tones = useTones()
  return (
    <span>
      <span fg={tones.dim}>against </span>
      {base}
    </span>
  )
}

// The repos going along with the change, in the title bar: "with api, docs +1".
function Added({ names }: { names: string }) {
  const tones = useTones()
  return (
    <text fg={tones.dim}>
      {"with "}
      <span fg={tones.accent}>{names}</span>
    </text>
  )
}

// The page around its list: why the branches couldn't be read, the list once it's drawn, the
// sheet under it while it's open, why a change couldn't be opened, and the footer.
function LandingView(props: {
  // behind another screen, the page draws nothing
  active: boolean
  list: ReactNode
  sheet: ReactNode
  // the repos added to go along, by name
  added: string | undefined
  // what the changes are measured against
  base: string | undefined
  // the view shown in the changes' place, or the changes, and what it's narrowed to
  view: View
  narrowed: Narrowed
  failed: string | undefined
  notice: string | undefined
  footer: readonly KeyHint[]
  help: boolean
}) {
  const tones = useTones()
  if (!props.active) {
    return null
  }

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <TitleBar
        left={titleOf(props.view, props.base, props.narrowed)}
        right={props.added === undefined ? undefined : <Added names={props.added} />}
      />
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
        <OrKeysHelp open={props.help} groups={GROUPS}>
          <box flexDirection="column">
            {props.failed !== undefined && <text fg={tones.bad}>{`✕ ${props.failed}`}</text>}
            {props.list ?? <Reading />}
          </box>
        </OrKeysHelp>
      </box>
      {props.sheet}
      {props.notice !== undefined && (
        <box
          border={["top"]}
          borderColor={tones.dim}
          style={{ flexShrink: 0, paddingLeft: PADDING, paddingRight: PADDING }}
        >
          <text fg={tones.bad}>{props.notice}</text>
        </box>
      )}
      <Footer keys={props.footer} />
    </box>
  )
}
