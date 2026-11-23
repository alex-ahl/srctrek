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
  TrekStatus,
} from "@srctrek/core"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
  type LandingItem,
  type LandingNote,
  LandingList,
  choiceKey,
  itemKey,
  statesKnown,
  useStatuses,
} from "./list"
import { type RepoItem, type Ticked, repoItems, toggled } from "./repos"
import type { DropView } from "./drop-view"
import { RepoSheet, sheetHeight, sheetKey } from "./sheet"
import { type Pending, choiceName } from "../opening"
import { useDrop } from "./use-drop"
import { type DoneTrek, type LandingRow, type Pick, doneRows, landingRows } from "./rows"
import { Footer, type KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { useTones } from "../ui/theme"
import { moveKeys, stepped } from "../ui/move"
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

/** What `load` answers; asked again only when `load` is a new one. */
function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ kind: "loading" })
  useEffect(() => {
    let current = true
    void load().then(
      (found) => current && setLoaded({ kind: "ready", found }),
      (error: unknown) => current && setLoaded({ kind: "failed", why: errorText(error) }),
    )
    return () => {
      current = false
    }
  }, [load])

  return loaded
}

const foundOr = <T,>(loaded: Loaded<T>, none: T): T =>
  loaded.kind === "ready" ? loaded.found : none

// What waits on the user's review, with nothing to open under it yet: still asking, none, or why.
function reviewNote(pulls: Loaded<OpenPullRequest[]>): LandingNote | undefined {
  const group = "WAITING ON YOUR REVIEW"
  if (pulls.kind === "loading") {
    return { group, text: "finding pull requests…", tone: "dim" }
  }

  if (pulls.kind === "failed") {
    return { group, text: `✕ ${pulls.why}`, tone: "bad" }
  }

  return pulls.found.some((pr) => pr.reviewRequested)
    ? undefined
    : { group, text: "nothing waiting on your review", tone: "dim" }
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
  const pulls = useLoaded(props.pullRequests)
  const done = useLoaded(props.done)
  const nearby = useLoaded(props.nearby)
  const rows = useMemo(
    () => landingRows(foundOr(branches, undefined), foundOr(pulls, [])),
    [branches, pulls],
  )
  const statuses = useStatuses(rows, props.status)
  const settled = useSettled([branches, done, nearby, pulls], statesKnown(rows, statuses))

  return {
    settled,
    statuses,
    branches,
    rows,
    done: doneRows(foundOr(done, [])),
    nearby: foundOr(nearby, []),
    note: reviewNote(pulls),
  }
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
  { key: "type", does: "to narrow" },
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

// The key of the line at `at`, none past the list.
function keyAt<T>(items: readonly T[], at: number, keyOf: (item: T) => string): string | undefined {
  const item = items[at]
  return item === undefined ? undefined : keyOf(item)
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

  const { repos: _ticked, ...change } = row.choice
  return repos.length === 0 ? change : { ...change, repos }
}

const DONE_HINT: KeyHint = { key: "esc", does: "done" }

// The keys for the list's line selected, and a to add repos, naming those added.
function listKeys(item: LandingItem | undefined, added: string | undefined): KeyHint[] {
  const add = { key: "a", does: "add repos", ...(added === undefined ? {} : { mark: added }) }
  return [
    { key: "enter", does: item?.kind === "change" ? "open" : "show" },
    add,
    { key: "S", does: "settings" },
    HELP_HINT,
  ]
}

// The keys for the sheet's repo selected: space ticks it, → its branches.
function sheetKeys(item: RepoItem | undefined): KeyHint[] {
  const line =
    item === undefined
      ? []
      : [
          { key: "space", does: item.pick === undefined ? "add repo" : "remove repo" },
          { key: "→", does: "branches" },
        ]

  return [...line, DONE_HINT, HELP_HINT]
}

// The footer: a repo's open branches' keys while they're open, else the selected line's.
const footerOf = (dropOpen: boolean, line: readonly KeyHint[]): readonly KeyHint[] =>
  dropOpen ? DROP_KEYS : line

const GROUPS: readonly KeyGroup[] = [
  {
    title: "the selected line",
    keys: [
      { key: "enter", does: "open the change, or show what's folded" },
      { key: "↑/↓", does: "choose a line (also j/k)" },
    ],
  },
  {
    title: "repos to go along",
    keys: [
      { key: "a", does: "add repos to the change" },
      { key: "space", does: "add a repo, or remove it" },
      { key: "→", does: "a repo's branches" },
      { key: "esc", does: "done" },
    ],
  },
  { title: "screens", keys: [{ key: "S", does: "settings" }] },
  { title: "leave", keys: [{ key: "q", does: "quit" }] },
]

// The lines in order: the changes, then the done treks, folded.
function itemsOf(
  rows: readonly LandingRow[],
  done: readonly LandingRow[],
  doneOpen: boolean,
): LandingItem[] {
  const change = (row: LandingRow): LandingItem => ({ kind: "change", row })
  const doneItems: LandingItem[] = doneOpen
    ? done.map(change)
    : done.length === 0
      ? []
      : [{ kind: "done-fold", count: done.length }]

  return [...rows.map(change), ...doneItems]
}

/** The selected line: the one with the key chosen, so it stays put as lines load around it. */
function selectedIndex<T>(
  items: readonly T[],
  chosen: string | undefined,
  keyOf: (item: T) => string,
): number {
  const at = items.findIndex((item) => keyOf(item) === chosen)
  return at === -1 ? 0 : at
}

// At most half the room below the title bar goes to the sheet, so the changes stay in view.
const sheetMost = (room: number) => Math.floor(room / 2)

// A letter typed with shift as its capital, "S", so maps name capitals as they're shown.
const shifted = (key: Readonly<{ name: string; shift: boolean }>) =>
  key.shift && key.name.length === 1 ? key.name.toUpperCase() : key.name

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
 * requests, the repo's other branches, code as it is, and, folded, the treks whose work is done;
 * the repos beside it to tick and take along in a sheet slid up over the list. Opens on the
 * user's own branch.
 */
export function Landing(props: Props) {
  const { height } = useTerminalDimensions()
  const { settled, statuses, branches, rows, done, nearby, note } = useRows(props)
  const [ticked, setTicked] = useState<Ticked>(new Map())
  const [doneOpen, setDoneOpen] = useState(false)
  // the selected line by its key, so it stays put as rows load above it
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const active = props.active !== false
  const checkouts = nearby
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetChosen, setSheetChosen] = useState<string | undefined>(undefined)
  const help = useKeysHelp()
  // what branches' ages are measured from
  const now = useNow()

  const items = itemsOf(rows, done, doneOpen)
  const selected = selectedIndex(items, chosen, itemKey)
  const item = items[selected]
  const sheetItems = repoItems(checkouts, ticked)
  const sheetAt = selectedIndex(sheetItems, sheetChosen, sheetKey)
  const repo = sheetItems[sheetAt]
  const repos = picksOf(ticked, checkouts)
  // what enter opens from the selected line, when it's a change's
  const picked = item?.kind === "change" ? pickOf(item.row, repos) : undefined
  useResting(active, picked, props.onRest)
  const drop = useDrop(props.repoBranches, props.fetchRepo, (pick) =>
    setTicked(new Map(ticked).set(pick.path, pick)),
  )
  const openDrop = () => repo !== undefined && drop.open(repo.checkout.path)
  const notice = useNotice(props.opening)
  const shownDrop = dropView(drop, ticked, now)

  const move = (by: number) => setChosen(keyAt(items, stepped(selected, by, items.length), itemKey))
  const moveInSheet = (by: number) =>
    setSheetChosen(keyAt(sheetItems, stepped(sheetAt, by, sheetItems.length), sheetKey))
  // an opened fold's line gives way to the first of what it held, which takes the selection
  const enter = () => {
    if (item?.kind === "done-fold") {
      setDoneOpen(true)
      setChosen(keyAt(itemsOf(rows, done, true), selected, itemKey))
    } else if (picked !== undefined) {
      props.onPick(picked)
    }
  }
  const common: Array<[string, () => void]> = [
    ["q", props.onQuit],
    ["?", help.show],
  ]
  const listActions = new Map([
    ["return", enter],
    ["a", () => setSheetOpen(true)],
    ["S", props.onSettings],
    ...common,
    ...moveKeys(move),
  ])
  const sheetActions = new Map([
    ["space", () => repo !== undefined && setTicked(toggled(ticked, repo.checkout))],
    ["right", openDrop],
    ["l", openDrop],
    ["escape", () => setSheetOpen(false)],
    ...common,
    ...moveKeys(moveInSheet),
  ])
  // While a repo's branches are open, keys go there; while the sheet is, there.
  useLandingKeys(
    active,
    help.guard((key) => {
      notice.seen()
      const actions = sheetOpen ? sheetActions : listActions
      return drop.key(key) || actions.get(shifted(key))?.()
    }),
  )

  const room = height - chromeLines(notice.text)
  const sheetLines = sheetOpen ? sheetHeight(sheetItems, shownDrop, sheetMost(room)) : 0

  return (
    <LandingView
      active={active}
      list={
        settled ? (
          <LandingList
            items={items}
            chosen={selected}
            statuses={statuses}
            note={note}
            muted={sheetOpen}
            tint={props.tint}
            opening={openingKey(props.opening)}
            height={room - sheetLines}
          />
        ) : undefined
      }
      sheet={
        sheetOpen ? (
          <RepoSheet
            items={sheetItems}
            chosen={sheetAt}
            drop={shownDrop}
            tint={props.tint}
            height={sheetLines}
          />
        ) : undefined
      }
      failed={branches.kind === "failed" ? branches.why : undefined}
      notice={notice.text}
      footer={footerOf(
        drop.drop !== undefined,
        help.footer(sheetOpen ? sheetKeys(repo) : listKeys(item, addedNames(ticked, checkouts))),
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

// The page around its list: why the branches couldn't be read, the list once it's drawn, the
// sheet under it while it's open, why a change couldn't be opened, and the footer.
function LandingView(props: {
  // behind another screen, the page draws nothing
  active: boolean
  list: ReactNode
  sheet: ReactNode
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
      <TitleBar />
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
      <Footer keys={props.footer} shown="" />
    </box>
  )
}
