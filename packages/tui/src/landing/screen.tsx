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
  itemKey,
  statesKnown,
  useStatuses,
} from "./list"
import { type Ticked, opensWith, repoItems, toggled } from "./repos"
import type { DropRow } from "./drop"
import type { DropView } from "./drop-view"
import { type Pending, choiceName } from "../opening"
import { useDrop } from "./use-drop"
import { type DoneTrek, type LandingRow, type Pick, doneRows, landingRows } from "./rows"
import { Footer, type KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { COLOUR, useTones } from "../ui/theme"
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

// The title bar, the line above the list, what enter opens, and the footer, each with its rule.
const CHROME_LINES = 7

const DROP_KEYS = [
  { key: "type", does: "to narrow" },
  { key: "enter", does: "take" },
  { key: "←/esc", does: "close" },
]

// The ticks as taking the drop's chosen line would leave them, for the line above the footer.
function withDropPick(ticked: Ticked, row: DropRow | undefined): Ticked {
  return row === undefined || row.kind === "more" || row.kind === "fetch"
    ? ticked
    : new Map(ticked).set(row.pick.path, row.pick)
}

// The ticked repos in the order they're listed.
const picksOf = (ticked: Ticked, checkouts: readonly NearbyCheckout[]): RepoPick[] =>
  checkouts.flatMap((checkout) => {
    const pick = ticked.get(checkout.path)
    return pick === undefined ? [] : [pick]
  })

// What enter does on a line: opens what's folded there, or the change.
function enterOn(
  item: LandingItem | undefined,
  does: Readonly<{ repos: () => void; done: () => void; pick: () => void }>,
): () => void {
  if (item?.kind === "fold") {
    return does.repos
  }

  return item?.kind === "done-fold" ? does.done : does.pick
}

// The key of the line at `at`, none past the list.
function keyAt(items: readonly LandingItem[], at: number): string | undefined {
  const item = items[at]
  return item === undefined ? undefined : itemKey(item)
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

// What the selected line opens, in words, for the line above the footer: a change's own line,
// else the user's own work, which the ticked repos go with until a change is chosen.
function opensOf(item: LandingItem | undefined, rows: readonly LandingRow[]): string {
  return item?.kind === "change" ? item.row.opens : (rows[0]?.opens ?? "")
}

// The footer: a repo's open branches' keys while they're open, else the selected line's.
const footerOf = (dropOpen: boolean, line: readonly KeyHint[]): readonly KeyHint[] =>
  dropOpen ? DROP_KEYS : line

// The keys for the line selected: enter opens a change or a fold, space ticks a repo.
function keysFor(item: LandingItem | undefined): KeyHint[] {
  const repo =
    item?.kind === "repo"
      ? [
          { key: "space", does: item.pick === undefined ? "add repo" : "remove repo" },
          { key: "→", does: "branches" },
        ]
      : [{ key: "enter", does: item?.kind === "change" ? "open" : "show" }]

  return [...repo, { key: "S", does: "settings" }, HELP_HINT]
}

const GROUPS: readonly KeyGroup[] = [
  {
    title: "the selected line",
    keys: [
      { key: "enter", does: "open the change, or show what's folded" },
      { key: "space", does: "add a repo to the change, or remove it" },
      { key: "→", does: "a repo's branches" },
      { key: "↑/↓", does: "choose a line (also j/k)" },
    ],
  },
  { title: "screens", keys: [{ key: "S", does: "settings" }] },
  { title: "leave", keys: [{ key: "q", does: "quit" }] },
]

// The lines in order: the changes, the repos beside this one, then the done treks, folded.
function itemsOf(
  rows: readonly LandingRow[],
  repos: LandingItem[],
  done: readonly LandingRow[],
  doneOpen: boolean,
): LandingItem[] {
  const change = (row: LandingRow): LandingItem => ({ kind: "change", row })
  const doneItems: LandingItem[] = doneOpen
    ? done.map(change)
    : done.length === 0
      ? []
      : [{ kind: "done-fold", count: done.length }]

  return [...rows.map(change), ...repos, ...doneItems]
}

/** The selected line: the one with the key chosen, so it stays put as lines load around it. */
function selectedIndex(items: readonly LandingItem[], chosen: string | undefined): number {
  const at = items.findIndex((item) => itemKey(item) === chosen)
  return at === -1 ? 0 : at
}

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

// What enter opens, in words, above the footer; or the change picked as it opens, or why it
// couldn't.
function OpensLine({ opens, opening }: { opens: string; opening: Pending | undefined }) {
  const tones = useTones()
  const name = opening === undefined ? "" : choiceName(opening.choice)
  return (
    <box
      border={["top"]}
      borderColor={tones.dim}
      style={{ flexShrink: 0, paddingLeft: PADDING, paddingRight: PADDING }}
    >
      {opening === undefined && (
        <text fg={COLOUR.text}>
          <span fg={tones.dim}>Opens: </span>
          {opens}
        </text>
      )}
      {opening?.kind === "opening" && <text fg={tones.busy}>{`◐ opening ${name}…`}</text>}
      {opening?.kind === "failed" && (
        <text fg={tones.bad}>{`✕ couldn't open ${name}: ${opening.why}`}</text>
      )}
    </box>
  )
}

/**
 * Every change there is to look at, each with its trek's state: the user's own work, the pull
 * requests, the repo's other branches, code as it is, the repos beside it to tick and take along,
 * and, folded, the treks whose work is done. Opens on the user's own branch.
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
  const [foldOpen, setFoldOpen] = useState(false)
  const help = useKeysHelp()
  // what branches' ages are measured from
  const now = useNow()

  const items = itemsOf(rows, repoItems(checkouts, ticked, foldOpen), done, doneOpen)
  const selected = selectedIndex(items, chosen)
  const item = items[selected]
  const repos = picksOf(ticked, checkouts)
  // what enter opens from the selected line, when it's a change's
  const picked = item?.kind === "change" ? pickOf(item.row, repos) : undefined
  useResting(active, picked, props.onRest)
  const drop = useDrop(props.repoBranches, props.fetchRepo, (pick) =>
    setTicked(new Map(ticked).set(pick.path, pick)),
  )
  const openDrop = () => item?.kind === "repo" && drop.open(item.checkout.path)
  // while a repo's branches are open, the line chosen there says what it would open
  const opens = opensWith(
    opensOf(item, rows),
    withDropPick(ticked, drop.rows?.[drop.drop?.at ?? 0]),
    checkouts,
  )

  const move = (by: number) => setChosen(keyAt(items, stepped(selected, by, items.length)))
  // an opened fold's line gives way to the first of what it held, which takes the selection
  const unfold = (opened: readonly LandingItem[]) => setChosen(keyAt(opened, selected))
  const enter = enterOn(item, {
    repos: () => {
      setFoldOpen(true)
      unfold(itemsOf(rows, repoItems(checkouts, ticked, true), done, doneOpen))
    },
    done: () => {
      setDoneOpen(true)
      unfold(itemsOf(rows, repoItems(checkouts, ticked, foldOpen), done, true))
    },
    pick: () => picked !== undefined && props.onPick(picked),
  })
  const keyActions = new Map([
    ["return", enter],
    ["space", () => item?.kind === "repo" && setTicked(toggled(ticked, item.checkout))],
    ["right", openDrop],
    ["l", openDrop],
    ["S", props.onSettings],
    ["q", props.onQuit],
    ["?", help.show],
    ...moveKeys(move),
  ])
  // While a repo's branches are open, keys go there.
  useLandingKeys(
    active,
    help.guard((key) => drop.key(key) || keyActions.get(shifted(key))?.()),
  )

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
            drop={dropView(drop, ticked, now)}
            tint={props.tint}
            height={height - CHROME_LINES}
          />
        ) : undefined
      }
      failed={branches.kind === "failed" ? branches.why : undefined}
      opens={settled && item !== undefined ? opens : undefined}
      opening={props.opening}
      footer={footerOf(drop.drop !== undefined, help.footer(keysFor(item)))}
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

// The page around its list: why the branches couldn't be read, the list once it's drawn, what
// enter opens, and the footer.
function LandingView(props: {
  // behind another screen, the page draws nothing
  active: boolean
  list: ReactNode
  failed: string | undefined
  opens: string | undefined
  opening: Pending | undefined
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
      {props.opens !== undefined && <OpensLine opens={props.opens} opening={props.opening} />}
      <Footer keys={props.footer} shown="" />
    </box>
  )
}
