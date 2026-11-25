import { errorText } from "@srctrek/core"
import type { KeyEvent, RGBA } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type {
  BranchChoices,
  ChangeChoice,
  NearbyCheckout,
  OpenPullRequest,
  RepoBranches,
  RepoPick,
  TrekEntry,
  TrekStatus,
} from "@srctrek/core"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
  type LandingNote,
  LandingList,
  choiceKey,
  rowKey,
  statesKnown,
  type StatusOf,
  useStatuses,
} from "./list"
import { type Ticked, toggled } from "./repos"
import type { DropView } from "./drop-view"
import { RepoSheet, sheetHeight } from "./sheet"
import { keyAt, selectedIndex } from "../ui/selection"
import { useSheet } from "./use-sheet"
import { type Pending, choiceName } from "../opening"
import { useDrop } from "./use-drop"
import { type DoneTrek, type LandingRow, type Pick, doneRows, landingRows } from "./rows"
import { Footer, type KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { useTones } from "../ui/theme"
import { count } from "../ui/text"
import { moveKeys, shifted, stepped } from "../ui/move"
import { useNow } from "../ui/clock"
import { TitleBar } from "../ui/title-bar"
import { useTurning } from "../ui/turning"

type Props = {
  // the changes to list: the branches, the open pull requests, the repos beside this one
  load: () => Promise<BranchChoices>
  pullRequests: () => Promise<OpenPullRequest[]>
  nearby: () => Promise<NearbyCheckout[]>
  // the branches of a repo beside this one, by its path, and fetching it on the user's word
  repoBranches: (path: string) => Promise<RepoBranches>
  fetchRepo: (path: string) => Promise<void>
  // where the trek of each change stands, filled in as each is worked out
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  pullStatus: StatusOf["pullStatus"]
  // the saved treks, for when each was built
  entries: () => Promise<TrekEntry[]>
  // how often the pull requests are read again while the page is in front
  pullsEvery?: number | undefined
  // the treks whose work has landed or gone
  done: () => Promise<DoneTrek[]>
  // whether the page is in front: behind another screen it keeps where it was, drawing nothing
  // and taking no keys, so going back finds it at once as it was left
  active?: boolean | undefined
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

/** What a load holds as it answers: nothing yet, what it found, or why it couldn't. */
type Loaded<T> =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; found: T }>
  | Readonly<{ kind: "failed"; why: string }>

/**
 * What `load` answers; asked again when `load` is a new one, and every `every` ms while given. A
 * read again that fails keeps what was found, so a moment offline doesn't empty the list.
 */
function useLoaded<T>(load: () => Promise<T>, every?: number): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ kind: "loading" })
  const reading = useRef<() => void>(undefined)
  useEffect(() => {
    let current = true
    const read = () =>
      void load().then(
        (found) => current && setLoaded({ kind: "ready", found }),
        (error: unknown) =>
          current &&
          setLoaded((was) =>
            was.kind === "ready" ? was : { kind: "failed", why: errorText(error) },
          ),
      )
    reading.current = read
    read()

    return () => {
      current = false
    }
  }, [load])

  // its own effect, so `every` coming and going starts and stops the asking, not a read
  useEffect(() => {
    if (every === undefined) {
      return undefined
    }

    const timer = setInterval(() => reading.current?.(), every)
    return () => clearInterval(timer)
  }, [every])

  return loaded
}

// Often enough that a pull request pushed to shows its trek stale soon after, one request a time.
const PULLS_EVERY_MS = 60_000

const foundOr = <T,>(loaded: Loaded<T>, none: T): T =>
  loaded.kind === "ready" ? loaded.found : none

// The pull requests, with none to open yet: still asking, none, or why they can't be listed.
function pullsNote(pulls: Loaded<OpenPullRequest[]>): LandingNote | undefined {
  const group = "pull requests"
  if (pulls.kind === "loading") {
    return { group, text: "finding pull requests…", tone: "dim" }
  }

  if (pulls.kind === "failed") {
    return { group, text: `✕ ${pulls.why}`, tone: "bad" }
  }

  return pulls.found.length === 0 ? { group, text: "none", tone: "dim" } : undefined
}

// Past this, the page is drawn with what it has, the rest filling its place as it comes, rather
// than kept back any longer, as by a host slow to list its pull requests.
const REVEAL_WAIT_MS = 1500

/**
 * Whether the page is drawn yet: once everything it lists has answered, or the wait is up; and
 * from then on, as what's read again only replaces what's shown.
 */
function useSettled(loads: readonly Loaded<unknown>[], known: boolean): boolean {
  const [waited, setWaited] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const ready = known && loads.every((loaded) => loaded.kind !== "loading")
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), REVEAL_WAIT_MS)
    return () => clearTimeout(timer)
  }, [])
  // remembered as it's first drawn, so a row read later, its state not known yet, never hides it
  if ((ready || waited) && !drawn) {
    setDrawn(true)
  }

  return drawn || ready || waited
}

// The changes as each list answers, and where each one's trek stands; one that can't be read
// leaves the others listed. The page is drawn once all of it is in, so it appears whole, in one
// frame, rather than growing and shifting as each list answers.
function useRows(props: Props) {
  const branches = useLoaded(props.load)
  const pulls = useLoaded(
    props.pullRequests,
    props.active === false ? undefined : (props.pullsEvery ?? PULLS_EVERY_MS),
  )
  const done = useLoaded(props.done)
  const nearby = useLoaded(props.nearby)
  const entries = useLoaded(props.entries)
  const builtAt = useMemo(() => builtTimes(foundOr(entries, [])), [entries])
  const rows = useMemo(
    () => landingRows(foundOr(branches, undefined), foundOr(pulls, [])),
    [branches, pulls],
  )
  const statuses = useStatuses(rows, { status: props.status, pullStatus: props.pullStatus })
  const settled = useSettled([branches, done, nearby, pulls], statesKnown(rows, statuses))

  return {
    settled,
    statuses,
    builtAt,
    branches,
    rows,
    done: doneRows(foundOr(done, [])),
    nearby: foundOr(nearby, []),
    note: pullsNote(pulls),
  }
}

// When each saved trek was built, by its name; one that can't be read has no time.
const builtTimes = (entries: readonly TrekEntry[]): ReadonlyMap<string, string> =>
  new Map(entries.flatMap((entry) => (entry.valid ? [[entry.name, entry.createdAt] as const] : [])))

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

// The keys for the list's line selected, and a to add repos.
function listKeys(done: number): KeyHint[] {
  const doneKey = done === 0 ? [] : [{ key: "d", does: count(done, "done trek") }]
  return [
    { key: "enter", does: "open" },
    { key: "a", does: "add repos" },
    ...doneKey,
    { key: "S", does: "settings" },
    HELP_HINT,
  ]
}

// The page's keys: the sheet's while it's open, else the done treks' or the changes'.
function pageKeys(
  sheet: readonly KeyHint[] | undefined,
  showingDone: boolean,
  done: number,
): readonly KeyHint[] {
  if (sheet !== undefined) {
    return sheet
  }

  return showingDone ? DONE_KEYS : listKeys(done)
}

const DONE_KEYS: readonly KeyHint[] = [
  { key: "enter", does: "open" },
  { key: "esc", does: "back" },
  HELP_HINT,
]

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
  const { settled, statuses, builtAt, branches, rows, done, nearby, note } = useRows(props)
  const [ticked, setTicked] = useState<Ticked>(new Map())
  // the done treks shown on their own view, in the changes' place
  const [showingDone, setShowingDone] = useState(false)
  // the selected line by its key, so it stays put as rows load above it
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const active = props.active !== false
  const checkouts = nearby
  const help = useKeysHelp()
  // what branches' ages are measured from
  const now = useNow()

  // the changes, or, on their own view, the done treks
  const items = showingDone ? done : rows
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
  const showDone = (shown: boolean) => {
    setShowingDone(shown)
    setChosen(undefined)
  }
  const doneActions = new Map([
    ["return", enter],
    ["escape", () => showDone(false)],
    ["q", props.onQuit],
    ["?", help.show],
    ...moveKeys(move),
  ])
  const keyActions = new Map([
    ["return", enter],
    ["d", () => done.length > 0 && showDone(true)],
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
      const actions = showingDone ? doneActions : keyActions
      return drop.key(key) || sheet.key(key) || actions.get(shifted(key))?.()
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
            note={showingDone ? undefined : note}
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
      showingDone={showingDone}
      failed={branches.kind === "failed" ? branches.why : undefined}
      notice={notice.text}
      footer={footerOf(
        drop.drop !== undefined,
        help.footer(pageKeys(sheet.open ? sheet.keys : undefined, showingDone, done.length)),
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

// What the title bar says the page shows: the done treks, or what the changes are measured
// against.
function titleOf(showingDone: boolean, base: string | undefined): ReactNode {
  if (showingDone) {
    return "done treks"
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
  // the done treks shown in the changes' place
  showingDone: boolean
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
        left={titleOf(props.showingDone, props.base)}
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
