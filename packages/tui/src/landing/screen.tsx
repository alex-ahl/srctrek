import { errorText, folderName } from "@srctrek/core"
import type { RGBA } from "@opentui/core"
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
import { useEffect, useMemo, useState } from "react"
import {
  type LandingItem,
  type LandingNote,
  LandingList,
  itemKey,
  pickKey,
  useStatuses,
} from "./list"
import { type Ticked, opensWith, repoItems, tickedOf, toggled } from "./repos"
import type { DropRow } from "./drop"
import { useDrop } from "./use-drop"
import { type DoneTrek, type LandingRow, type Pick, doneRows, landingRows } from "./rows"
import { Footer, type KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { COLOUR, useTones } from "../ui/theme"
import { moveKeys, stepped } from "../ui/move"
import { useNow } from "../ui/clock"
import { TitleBar } from "../ui/title-bar"

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
  // what was opened from here last, selected again with its repos ticked, as the page opens
  from: Pick | undefined
  onPick: (pick: Pick) => void
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

// The changes as each list answers; one that can't be read leaves the others listed.
function useRows(props: Props) {
  const branches = useLoaded(props.load)
  const pulls = useLoaded(props.pullRequests)
  const done = useLoaded(props.done)
  const rows = useMemo(
    () => landingRows(foundOr(branches, undefined), foundOr(pulls, [])),
    [branches, pulls],
  )

  return { branches, rows, done: doneRows(foundOr(done, [])), note: reviewNote(pulls) }
}

// The repos beside this one; none until they're found, or when they can't be.
function useCheckouts(nearby: () => Promise<NearbyCheckout[]>): readonly NearbyCheckout[] {
  const [found, setFound] = useState<readonly NearbyCheckout[]>([])
  useEffect(() => {
    void nearby().then(setFound, () => undefined)
  }, [nearby])

  return found
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

// A ticked repo that isn't beside this one, such as one trek was started with by path or URL,
// listed from its tick so picking keeps it.
const fromPick = (pick: RepoPick): NearbyCheckout => ({
  path: pick.path,
  name: folderName(pick.path),
  branch: pick.branch,
  commits: 0,
})

// The repos beside this one, then any ticked that aren't among them.
function listedCheckouts(nearby: readonly NearbyCheckout[], ticked: Ticked): NearbyCheckout[] {
  const unlisted = [...ticked.values()].filter((pick) => !nearby.some((n) => n.path === pick.path))

  return [...nearby, ...unlisted.map(fromPick)]
}

// The ticked repos in the order they're listed.
const picksOf = (ticked: Ticked, checkouts: readonly NearbyCheckout[]): RepoPick[] =>
  checkouts.flatMap((checkout) => {
    const pick = ticked.get(checkout.path)
    return pick === undefined ? [] : [pick]
  })

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

/**
 * Every change there is to look at, each with its trek's state: the user's own work, the pull
 * requests, the repo's other branches, code as it is, the repos beside it to tick and take along,
 * and, folded, the treks whose work is done. Opens on the user's own branch.
 */
export function Landing(props: Props) {
  const tones = useTones()
  const { height } = useTerminalDimensions()
  const { branches, rows, done, note } = useRows(props)
  const nearby = useCheckouts(props.nearby)
  const [ticked, setTicked] = useState(() =>
    tickedOf(props.from?.kind === "trek" ? undefined : props.from?.repos),
  )
  const checkouts = listedCheckouts(nearby, ticked)
  const [foldOpen, setFoldOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(props.from?.kind === "trek")
  // the selected line by its key, so it stays put as rows load above it
  const [chosen, setChosen] = useState(() =>
    props.from === undefined ? undefined : pickKey(props.from),
  )
  const statuses = useStatuses(rows, props.status)
  const help = useKeysHelp()
  // what branches' ages are measured from
  const now = useNow()

  const items = itemsOf(rows, repoItems(checkouts, ticked, foldOpen), done, doneOpen)
  const selected = selectedIndex(items, chosen)
  const item = items[selected]
  const repos = picksOf(ticked, checkouts)
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

  const move = (by: number) => {
    const next = items[stepped(selected, by, items.length)]
    setChosen(next === undefined ? undefined : itemKey(next))
  }
  // an opened fold's line gives way to the first of what it held, which takes the selection
  const unfold = (opened: readonly LandingItem[]) => {
    const first = opened[selected]
    setChosen(first === undefined ? undefined : itemKey(first))
  }
  const enter = () => {
    if (item?.kind === "fold") {
      setFoldOpen(true)
      unfold(itemsOf(rows, repoItems(checkouts, ticked, true), done, doneOpen))
    } else if (item?.kind === "done-fold") {
      setDoneOpen(true)
      unfold(itemsOf(rows, repoItems(checkouts, ticked, foldOpen), done, true))
    } else if (item?.kind === "change") {
      props.onPick(pickOf(item.row, repos))
    }
  }
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
  useKeyboard(help.guard((key) => drop.key(key) || keyActions.get(shifted(key))?.()))

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
        <OrKeysHelp open={help.open} groups={GROUPS}>
          <box flexDirection="column">
            {branches.kind === "failed" && <text fg={tones.bad}>{`✕ ${branches.why}`}</text>}
            <LandingList
              items={items}
              chosen={selected}
              statuses={statuses}
              note={note}
              drop={
                drop.drop === undefined
                  ? undefined
                  : {
                      drop: drop.drop,
                      rows: drop.rows,
                      problem: drop.problem,
                      pick: ticked.get(drop.drop.path),
                      now,
                    }
              }
              tint={props.tint}
              height={height - CHROME_LINES}
            />
          </box>
        </OrKeysHelp>
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
      <Footer keys={drop.drop === undefined ? help.footer(keysFor(item)) : DROP_KEYS} shown="" />
    </box>
  )
}
