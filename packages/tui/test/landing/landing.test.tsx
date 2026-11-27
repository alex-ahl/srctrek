import { expect, mock, test } from "bun:test"
import type {
  BranchChoices,
  ChangeChoice,
  NearbyCheckout,
  OpenPullRequest,
  RepoBranch,
  RepoBranches,
  TrekEntry,
  TrekStatus,
} from "@srctrek/core"
import { dropRows, opened } from "../../src/landing/drop"
import {
  type DoneTrek,
  type Pick,
  landingRows,
  otherBranchRows,
  otherPullRows,
  withoutCheckedOut,
  yourPullRows,
} from "../../src/landing/rows"
import { Landing } from "../../src/landing/screen"
import { deferred } from "../support/deferred"
import { type Screen, frameAfter } from "../support/keys"

const choices: BranchChoices = {
  base: "main",
  own: { name: "feature/refunds", commits: 3 },
  uncommittedFiles: 2,
  others: [
    { name: "fix/rounding", commits: 1, mine: true },
    { name: "feature/partial-refunds", commits: 5, mine: true },
  ],
}

const own: ChangeChoice = { kind: "own", uncommitted: false }

const done: DoneTrek[] = [
  { name: "feature-coupons", title: "Applying a coupon", why: "merged" },
  { name: "spike-ledger", title: "Posting to the ledger", why: "branch gone" },
]

// The user's own branch has a trek; no other change has, nor has the code its ways in.
function statusOf(choice: ChangeChoice): Promise<TrekStatus> {
  if (choice.kind === "own" && !choice.uncommitted) {
    return Promise.resolve({ kind: "ready", name: "feature-refunds" })
  }

  return Promise.resolve({ kind: "missing", name: choice.kind === "code" ? "web" : "a-change" })
}

// As statusOf, but feature/partial-refunds's trek is still being worked out.
const stillWorking = (choice: ChangeChoice): Promise<TrekStatus> =>
  choice.kind === "branch" && choice.name === "feature/partial-refunds"
    ? new Promise(() => undefined)
    : statusOf(choice)

const open: OpenPullRequest[] = [
  {
    number: 12,
    title: "Add partial refunds",
    author: "alice",
    url: "https://github.com/acme/web/pull/12",
    draft: false,
    reviewRequested: true,
    mine: false,
    head: "a12",
    base: "main",
    updatedAt: "2026-11-23T10:00:00Z",
    commits: 3,
  },
  {
    number: 14,
    title: "Round refunds to cents",
    author: "bo",
    url: "https://github.com/acme/web/pull/14",
    draft: true,
    reviewRequested: false,
    mine: false,
    head: "b14",
    base: "main",
    updatedAt: "2026-11-23T10:00:00Z",
    commits: 3,
  },
]

// #12's trek was built at its head; #14 has none.
const pullStatusOf = ({ number }: Readonly<{ number: number }>): Promise<TrekStatus> =>
  Promise.resolve(
    number === 12 ? { kind: "ready", name: "pr-12" } : { kind: "missing", name: `pr-${number}` },
  )

// api's branches, most recent first: refunds-v2 by alice, refunds-api checked out, then older.
const HOUR = 60 * 60 * 1000
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()
const branch = (name: string, hours: number, extra: Partial<RepoBranch> = {}): RepoBranch => ({
  name,
  committedAt: ago(hours),
  author: "alice",
  mine: false,
  subject: `Work on ${name}`,
  commits: 2,
  checkedOut: false,
  ...extra,
})
const apiBranches: RepoBranches = {
  base: "origin/main",
  branches: [
    branch("refunds-v2", 2, { subject: "Split partial refunds into their own handler" }),
    branch("spike/ledger", 30, { author: "bo" }),
    branch("fix/timeouts", 60),
    branch("refunds-api", 80, { mine: true, commits: 4, checkedOut: true }),
    branch("old/refunds-poc", 900),
  ],
}

// Beside web: api with work on refunds-api, worker and docs on main.
const nearby: NearbyCheckout[] = [
  { path: "../api", name: "api", branch: "refunds-api", commits: 4 },
  { path: "../docs", name: "docs", branch: "main", commits: 0 },
  { path: "../worker", name: "worker", branch: "main", commits: 0 },
]

const fetchRepo = mock((_path: string) => Promise.resolve())

// The trek of the user's branch, built two hours ago.
const entries = (): Promise<TrekEntry[]> =>
  Promise.resolve([
    {
      name: "feature-refunds",
      path: "feature-refunds.json",
      valid: true,
      title: "Partial refund of order o_1002",
      overview: "",
      trigger: "POST /refunds",
      steps: 14,
      highFlags: 0,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      repos: 1,
      code: false,
      heads: [],
    },
  ])

type Setup = Partial<{
  load: () => Promise<BranchChoices>
  onPick: (pick: Pick) => void
  onSettings: () => void
  onQuit: () => void
  pullRequests: () => Promise<OpenPullRequest[]>
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  pullsEvery: number
  repoBranches: (path: string) => Promise<RepoBranches>
  nearby: NearbyCheckout[]
  // beside a change's screen, as where there's room
  split: boolean
  flagged: (name: string) => Promise<boolean>
}>

// Beside a change's screen, and which treks are flagged, where the setup says.
const besideOf = (setup: Setup) => ({
  ...(setup.split === true ? { split: { beside: undefined } } : {}),
  ...(setup.flagged === undefined ? {} : { flagged: setup.flagged }),
})

function landing(setup: Setup = {}) {
  return (
    <Landing
      load={setup.load ?? (() => Promise.resolve(choices))}
      pullRequests={setup.pullRequests ?? (() => Promise.resolve(open))}
      nearby={() => Promise.resolve(setup.nearby ?? nearby)}
      repoBranches={setup.repoBranches ?? (() => Promise.resolve(apiBranches))}
      fetchRepo={fetchRepo}
      status={setup.status ?? statusOf}
      pullStatus={pullStatusOf}
      entries={entries}
      {...(setup.pullsEvery === undefined ? {} : { pullsEvery: setup.pullsEvery })}
      done={() => Promise.resolve(done)}
      onPick={setup.onPick ?? (() => undefined)}
      onSettings={setup.onSettings ?? (() => undefined)}
      onQuit={setup.onQuit ?? (() => undefined)}
      tint={undefined}
      {...besideOf(setup)}
    />
  )
}

type Input = Parameters<Parameters<typeof frameAfter>[1]>[0]

// Everything listed: own work, the user's branches, code, and what's besides them.
const listed = async (_input: Input, on: Screen) => {
  await on.shows("p: 1 pull request")
  await on.shows("d: 2 done treks")
}

// Everything listed, and the repos beside this one in the sheet a opens.
const sheetOpen = async (input: Input, on: Screen) => {
  await listed(input, on)
  input.pressKey("a")
  await on.shows("ADD REPOS")
}

// Down `times` rows, a draw after each, so each lands before the next.
async function down(input: Input, on: Screen, times: number) {
  for (const _ of Array.from({ length: times })) {
    input.pressKey("j")
    await on.drawn()
  }
}

// Down `times` lines where letters are typed, in the sheet or a view of its own: by the arrow.
async function downSheet(input: Input, on: Screen, times: number) {
  for (const _ of Array.from({ length: times })) {
    input.pressArrow("down")
    await on.drawn()
  }
}

test("offers the user's own work first, then their branches, each saying what it opens", () => {
  const rows = landingRows(choices, open)

  expect(rows.map((row) => [row.group, row.label, row.detail])).toEqual([
    ["checked out", "feature/refunds", "3 commits"],
    ["checked out", "uncommitted", "2 files changed"],
    ["pull requests", "#12 Add partial refunds", "3 commits"],
    ["your branches", "fix/rounding", "1 commit"],
    ["your branches", "feature/partial-refunds", "5 commits"],
    ["code as it is", "its ways in", ""],
  ])
})

// bo's #14, opened from bo/tax
const fromTax: OpenPullRequest = {
  number: 14,
  title: "Round refunds to cents",
  author: "bo",
  url: "https://github.com/acme/web/pull/14",
  draft: false,
  reviewRequested: false,
  mine: false,
  head: "b14",
  branch: "bo/tax",
  base: "main",
  updatedAt: "2026-11-23T10:00:00Z",
  commits: 3,
}

test("a branch an open pull request was opened from is listed as that pull request alone", () => {
  const fromRounding = { ...fromTax, mine: true, branch: "fix/rounding" }
  const rows = landingRows(choices, [fromRounding])

  expect(rows.map((row) => row.label)).toEqual([
    "feature/refunds",
    "uncommitted",
    "#14 Round refunds to cents",
    "feature/partial-refunds",
    "its ways in",
  ])
})

test("the branch checked out is the pull request opened from it, listed once", () => {
  const fromOwn: OpenPullRequest = {
    ...fromTax,
    number: 20,
    title: "Partial refunds",
    mine: true,
    branch: "feature/refunds",
  }
  const withOwn = [fromOwn, ...open]
  const rows = landingRows(choices, withOwn)

  expect(rows.map((row) => [row.group, row.label])).toEqual([
    ["checked out", "#20 Partial refunds"],
    ["checked out", "uncommitted"],
    ["pull requests", "#12 Add partial refunds"],
    ["your branches", "fix/rounding"],
    ["your branches", "feature/partial-refunds"],
    ["code as it is", "its ways in"],
  ])
  // its trek is the pull request's
  expect(rows[0]?.choice).toEqual({ kind: "pull-request", url: fromOwn.url })
  // and it's on no view of its own besides
  const others = otherPullRows(withoutCheckedOut(choices, withOwn), "main")
  expect(others.map((row) => row.label)).not.toContain("#20 Partial refunds")
})

test("the other branches leave out those an open pull request was opened from", () => {
  const withRemote: BranchChoices = {
    ...choices,
    others: [{ name: "origin/bo/tax", commits: 2, mine: false }],
  }

  expect(otherBranchRows(withRemote, [fromTax])).toEqual([])
})

test("beside a change's screen, a mark follows each state: ⚠ for a likely-wrong step, ⚑ for a review waiting", async () => {
  const frame = await frameAfter(
    landing({ split: true, flagged: (name) => Promise.resolve(name === "feature-refunds") }),
    listed,
    130,
    34,
  )

  expect(frame).toMatch(/feature\/refunds +● ⚠/)
  expect(frame).toMatch(/#12 Add partial refunds +● ⚑/)
  // the selected line's edge in its trek's state
  expect(frame).toMatch(/▌ feature\/refunds/)
})

test("leaves out the uncommitted row when everything is committed", () => {
  const labels = landingRows({ ...choices, uncommittedFiles: 0 }, []).map((row) => row.label)

  expect(labels).not.toContain("with uncommitted work")
})

test("offers the open pull requests by number and title, with their commits and what waits", () => {
  const rows = [...yourPullRows(open, "main"), ...otherPullRows(open, "main")]

  expect(rows.map((row) => [row.group, row.label, row.detail, row.mark])).toEqual([
    ["pull requests", "#12 Add partial refunds", "3 commits", "review requested"],
    ["pull requests", "#14 Round refunds to cents", "3 commits  ¦  draft", undefined],
  ])
})

test("a pull request into another branch than the repo's says so; the latest first", () => {
  const older: OpenPullRequest = {
    number: 14,
    title: "Round refunds to cents",
    author: "bo",
    url: "https://github.com/acme/web/pull/14",
    draft: true,
    reviewRequested: false,
    mine: false,
    head: "b14",
    base: "main",
    updatedAt: "2026-11-20T10:00:00Z",
    commits: 3,
  }
  const into = { ...older, number: 16, base: "release/2.1", updatedAt: "2026-11-23T12:00:00Z" }
  const rows = otherPullRows([older, into], "origin/main")

  expect(rows.map((row) => [row.label, row.detail])).toEqual([
    ["#16 Round refunds to cents", "3 commits  ¦  into release/2.1  ¦  draft"],
    ["#14 Round refunds to cents", "3 commits  ¦  draft"],
  ])
})

test("opens on the user's own branch, every change under its heading", async () => {
  const frame = await frameAfter(landing(), listed, 110, 34)

  // what the changes are measured against, once
  expect(frame).toMatch(/srctrek › against main/)
  // what needs the user first: what's checked out, then the pull requests, each group counted
  expect(frame).toMatch(
    /\n  checked out 2 *\s+▶ feature\/refunds +3 commits +● ready  built 2h ago\s+uncommitted +2 files changed +○ no trek yet *\n *\n  pull requests 1 *\s+#12 Add partial refunds +3 commits  ¦  review requested +● ready/,
  )
  // uncommitted work set in under its branch
  expect(frame).toMatch(/\n {8}uncommitted/)
  // each group under its name, a blank line before it
  expect(frame).toMatch(
    /● ready *\n *\n  your branches 2 *\s+fix\/rounding +1 commit +○ no trek yet/,
  )
  // the other pull requests wait on a view of their own
  expect(frame).not.toContain("#14 Round refunds")
  expect(frame).toMatch(/\n  code as it is 1 *\s+its ways in +○ not found yet/)
  // the done treks wait on a view of their own
  expect(frame).not.toMatch(/\n  done/)
  // a group's name at the page's left, its rows set in under it, nothing drawn
  expect(frame).toMatch(/\n {2}checked out 2 *\n {4}▶ feature/)
  // a ready trek says when it was built
  expect(frame).toMatch(/feature\/refunds +3 commits +● ready  built 2h ago/)
  // one table: every row's state in one column
  const stateAt = (name: string) =>
    frame
      .split("\n")
      .find((line) => line.includes(name))
      ?.search(/[●○≠]/)
  expect(stateAt("feature/refunds")).toBe(stateAt("its ways in"))
  expect(stateAt("#12 Add")).toBe(stateAt("fix/rounding"))
  // the repos beside this one wait in the sheet a opens
  expect(frame).not.toContain("../api")
  expect(frame).toContain(
    "↵: open  ¦  a: add repos  ¦  p: 1 pull request  ¦  d: 2 done treks  ¦  ?: keys",
  )
})

test("says on each row whether a trek of it exists, as each is worked out", async () => {
  const frame = await frameAfter(landing({ status: stillWorking }), (_input, on) =>
    on.shows("○ no trek yet"),
  )

  expect(frame).toMatch(/feature\/refunds +3 commits +● ready/)
  expect(frame).toMatch(/fix\/rounding +1 commit +○ no trek yet/)
  expect(frame).toMatch(/feature\/partial-refunds +5 commits +[◐◓◑◒]/)
})

test("enter opens the selected change", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 3)
      input.pressEnter()
    },
    110,
    34,
  )

  expect(onPick).toHaveBeenCalledWith({ kind: "branch", name: "fix/rounding" })
})

test("a pull request is opened by its link", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 2)
      input.pressEnter()
    },
    110,
    34,
  )

  expect(onPick).toHaveBeenCalledWith({
    kind: "pull-request",
    url: "https://github.com/acme/web/pull/12",
  })
})

test("code as it is is one row, opening its ways in", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 6)
      input.pressEnter()
    },
    110,
    34,
  )

  expect(onPick).toHaveBeenCalledWith({ kind: "code" })
})

test("says when there are no pull requests, or why they can't be listed", async () => {
  const none = await frameAfter(landing({ pullRequests: () => Promise.resolve([]) }), (_i, on) =>
    on.shows(/\n  pull requests  none/),
  )
  const failed = await frameAfter(
    landing({ pullRequests: () => Promise.reject(new Error("gh: not logged in")) }),
    (_i, on) => on.shows("✕ gh: not logged in"),
  )

  expect(none).toMatch(/\n  pull requests  none *\n/)
  expect(failed).toMatch(/\n  pull requests  ✕ gh: not logged in *\n/)
  expect(failed).toContain("fix/rounding")
})

test("the selection stays on its row as rows are listed above it", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  const pulls = deferred<OpenPullRequest[]>()
  await frameAfter(landing({ onPick, pullRequests: () => pulls.promise }), async (input, on) => {
    await on.shows("fix/rounding")
    // own, uncommitted, then fix/rounding, with no pull requests listed yet
    await down(input, on, 2)
    pulls.resolve(open)
    await on.shows("#12 Add partial refunds")
    input.pressEnter()
  })

  expect(onPick).toHaveBeenCalledWith({ kind: "branch", name: "fix/rounding" })
})

test("d lists the treks whose work has landed on a view of their own; enter opens one", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  const frame = await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await listed(input, on)
      input.pressKey("d")
      await on.shows("Applying a coupon")
      input.pressEnter()
    },
    110,
    40,
  )

  // how a done trek's work ended is its state; the changes give way to them
  expect(frame).toMatch(/srctrek › done treks/)
  expect(frame).toMatch(/\n  done 2 *\s+▶ Applying a coupon +✓ merged/)
  expect(frame).toMatch(/Posting to the ledger +✓ branch gone/)
  expect(frame).not.toContain("feature/refunds")
  expect(frame).toContain("↵: open  ¦  esc: back")
  expect(onPick).toHaveBeenCalledWith({ kind: "trek", name: "feature-coupons", why: "merged" })
})

test("esc from the done treks goes back to the changes", async () => {
  const frame = await frameAfter(landing(), async (input, on) => {
    await listed(input, on)
    input.pressKey("d")
    await on.shows("Applying a coupon")
    input.pressEscape()
    await on.shows("feature/refunds")
  })

  expect(frame).not.toContain("Applying a coupon")
})

test("S opens settings, and q quits", async () => {
  const onSettings = mock(() => undefined)
  const onQuit = mock(() => undefined)
  await frameAfter(landing({ onSettings, onQuit }), async (input, on) => {
    await on.shows("feature/refunds")
    input.pressKey("S", { shift: true })
    input.pressKey("q")
  })

  expect(onSettings).toHaveBeenCalled()
  expect(onQuit).toHaveBeenCalled()
})

test("a slides up every repo beside this one under the changes, those with work first", async () => {
  const frame = await frameAfter(landing(), sheetOpen, 110, 34)

  expect(frame).toMatch(/\n  checked out 2 *\s+▶ feature\/refunds/)
  expect(frame).toMatch(
    /ADD REPOS\s+▶ \[ \] api +\.\.\/api +refunds-api ▸ +4 commits\s+\[ \] docs +\.\.\/docs +main\s+\[ \] worker/,
  )
  expect(frame).toContain("type: narrow  ¦  space: add repo  ¦  →: branches  ¦  esc: done")
})

test("space adds a repo in the sheet; esc closes it, the title bar naming what goes along", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  const frame = await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await sheetOpen(input, on)
      input.pressKey(" ")
      await on.shows("ADD REPOS  ¦  1 added")
      input.pressEscape()
      await on.shows("a: add repos")
      input.pressEnter()
    },
    110,
    34,
  )

  expect(frame).not.toContain("ADD REPOS")
  expect(frame).toMatch(/srctrek › against main +with api *\n/)
  expect(frame).toContain(
    "↵: open  ¦  a: add repos  ¦  p: 1 pull request  ¦  d: 2 done treks  ¦  ?: keys",
  )
  expect(onPick).toHaveBeenCalledWith({ ...own, repos: [{ path: "../api", changed: true }] })
})

test("space on the list adds nothing", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  await frameAfter(landing({ onPick }), async (input, on) => {
    await listed(input, on)
    input.pressKey(" ")
    input.pressEnter()
  })

  expect(onPick).toHaveBeenCalledWith(own)
})

test("typing narrows the sheet's repos by name or path, space still adding", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await sheetOpen(input, on)
      input.pressKey("w")
      input.pressKey("o")
      await on.shows("/ wo▏")
      input.pressKey(" ")
      await on.shows("[x] worker")
    },
    110,
    34,
  )

  expect(frame).toMatch(/ADD REPOS  ¦  1 added +\/ wo▏ *\n/)
  expect(frame).not.toContain("../api")
  expect(frame).not.toContain("../docs")
  expect(frame).toContain("type: narrow  ¦  space: remove repo  ¦  →: branches  ¦  esc: clear")
})

test("in the sheet, letters are typed, not keys; nothing matching says so", async () => {
  const onQuit = mock(() => undefined)
  const frame = await frameAfter(
    landing({ onQuit }),
    async (input, on) => {
      await sheetOpen(input, on)
      input.pressKey("j")
      input.pressKey("q")
      await on.shows("/ jq▏")
    },
    110,
    34,
  )

  expect(frame).toContain("no repo matches")
  expect(onQuit).not.toHaveBeenCalled()
})

test("the count of repos added includes those the narrowing hides", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await sheetOpen(input, on)
      input.pressKey(" ")
      input.pressKey("w")
      await on.shows("/ w▏")
    },
    110,
    34,
  )

  expect(frame).toContain("ADD REPOS  ¦  1 added")
  expect(frame).not.toContain("../api")
})

test("esc clears what's typed, then closes the sheet, which opens again unnarrowed", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await sheetOpen(input, on)
      input.pressKey("w")
      await on.shows("/ w▏")
      input.pressEscape()
      await on.shows("esc: done")
      input.pressKey("w")
      await on.shows("/ w▏")
      input.pressEscape()
      await on.shows("esc: done")
      input.pressEscape()
      await on.shows("a: add repos")
      input.pressKey("a")
      await on.shows("ADD REPOS")
    },
    110,
    34,
  )

  expect(frame).toContain("../api")
  expect(frame).not.toContain("/ w")
})

test("a repo on its default branch is passed through", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await sheetOpen(input, on)
      await downSheet(input, on, 2)
      input.pressKey(" ")
      await on.shows("[x] worker")
    },
    110,
    34,
  )

  expect(frame).toMatch(/\[x\] worker +\.\.\/worker +main ▸ +passed through/)
})

test("with more than two repos added, the title bar names two and counts the rest", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await sheetOpen(input, on)
      for (const _ of Array.from({ length: 3 })) {
        input.pressKey(" ")
        await downSheet(input, on, 1)
      }
      await on.shows("ADD REPOS  ¦  3 added")
      input.pressEscape()
      await on.shows("a: add repos")
    },
    110,
    34,
  )

  expect(frame).toMatch(/srctrek › against main +with api, docs \+1 *\n/)
})

test("on a short terminal, the sheet scrolls to keep its selection in view", async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    path: `../repo-${String(i)}`,
    name: `repo-${String(i)}`,
    branch: "main",
    commits: 1,
  }))
  const frame = await frameAfter(
    landing({ nearby: many }),
    async (input, on) => {
      await sheetOpen(input, on)
      await downSheet(input, on, 19)
      await on.shows(/▶ \[ \] repo-19 /)
    },
    110,
    24,
  )

  expect(frame).toMatch(/▶ \[ \] repo-19 /)
  expect(frame).toContain("ADD REPOS")
  expect(frame).toMatch(/\n  checked out/)
})

test("a repo's drop: the few latest and the checked-out one, the rest under a count, then main", () => {
  const rows = dropRows(apiBranches, opened("../api"))

  expect(rows.map((row) => (row.kind === "branch" ? row.branch.name : row.kind))).toEqual([
    "refunds-v2",
    "spike/ledger",
    "fix/timeouts",
    "refunds-api",
    "more",
    "base",
    "fetch",
  ])
  expect(rows[4]).toEqual({ kind: "more", count: 1 })
  expect(rows[5]).toMatchObject({ name: "main", pick: { changed: false, branch: "main" } })
  expect(rows[3]).toMatchObject({ pick: { path: "../api", changed: true } })
})

test("typing narrows a repo's branches by name, author, or message", () => {
  const byAuthor = dropRows(apiBranches, { ...opened("../api"), query: "bo" })
  const byMessage = dropRows(apiBranches, { ...opened("../api"), query: "handler" })

  expect(byAuthor.flatMap((row) => (row.kind === "branch" ? [row.branch.name] : []))).toEqual([
    "spike/ledger",
  ])
  expect(byMessage.flatMap((row) => (row.kind === "branch" ? [row.branch.name] : []))).toEqual([
    "refunds-v2",
  ])
})

// The sheet with api's branches open.
const openDrop = async (input: Input, on: Screen) => {
  await sheetOpen(input, on)
  input.pressArrow("right")
  await on.shows("┌")
}

test("→ on a repo opens its branches under it, with when, who, and what", async () => {
  const frame = await frameAfter(landing(), openDrop, 120, 40)

  expect(frame).toMatch(/┌ refunds-v2 +2h ago +alice +Split partial refunds into their own handler/)
  expect(frame).toMatch(/│ refunds-api +3d ago +you +Work on refunds-api +checked out/)
  expect(frame).toContain("▸ 1 more branches")
  expect(frame).toMatch(/│ main +its default branch  ¦  passes it through/)
  expect(frame).toContain("└ ↻ look for new branches on the remote")
  expect(frame).toContain("type: narrow  ¦  ↵: take  ¦  ←/esc: close")
})

test("enter takes a branch, ticking the repo on it", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await openDrop(input, on)
      input.pressEnter()
      await on.shows("[x] api")
    },
    120,
    40,
  )

  expect(frame).toMatch(/\[x\] api +\.\.\/api +refunds-v2 ▸ +you have refunds-api out/)
  expect(frame).not.toContain("┌")
})

test("typed letters narrow the open branches; the default branch passes the repo through", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await openDrop(input, on)
      input.pressKey("m")
      input.pressKey("a")
      await on.drawn()
      input.pressEnter()
      await on.shows("[x] api")
    },
    120,
    40,
  )

  expect(frame).toMatch(/\[x\] api +\.\.\/api +main ▸ +passed through  ¦  you have refunds-api out/)
})

test("the fetch line fetches the repo, then lists its branches again", async () => {
  fetchRepo.mockClear()
  await frameAfter(
    landing(),
    async (input, on) => {
      await openDrop(input, on)
      for (const _ of Array.from({ length: 6 })) {
        input.pressArrow("down")
        await on.drawn()
      }
      input.pressEnter()
      await on.drawn()
    },
    120,
    40,
  )

  expect(fetchRepo).toHaveBeenCalledWith("../api")
})

test("← and esc close a repo's branches without taking one, leaving the sheet open", async () => {
  for (const close of ["left", "escape"] as const) {
    const frame = await frameAfter(
      landing(),
      async (input, on) => {
        await openDrop(input, on)
        if (close === "left") {
          input.pressArrow("left")
        } else {
          input.pressEscape()
        }
        await on.shows("space: add repo  ¦  →: branches")
      },
      120,
      40,
    )

    expect(frame).not.toContain("┌")
    expect(frame).toContain("ADD REPOS")
    expect(frame).toMatch(/\[ \] api +\.\.\/api +refunds-api ▸/)
  }
})

test("says why a repo's branches couldn't be read, instead of waiting for them", async () => {
  const frame = await frameAfter(
    landing({ repoBranches: () => Promise.reject(new Error("no base branch")) }),
    async (input, on) => {
      await sheetOpen(input, on)
      input.pressArrow("right")
      await on.shows("✕ no base branch")
    },
    120,
    40,
  )

  expect(frame).toContain("└ ✕ no base branch")
  expect(frame).not.toContain("finding branches")
})

test("code as it is says where finding its ways in stands, not a trek's state", async () => {
  const frame = await frameAfter(landing(), (_input, on) => on.shows("not found yet"))

  expect(frame).toMatch(/its ways in +○ not found yet/)
})

// The done treks opened, and the last of the twelve selected.
async function toLastDone(input: Input, on: Screen) {
  // what's read here is in once the list is drawn; the pull requests once counted
  await on.shows("p: 1 pull request")
  input.pressKey("d")
  await on.shows(/▶ Old trek 0 /)
  // on a view of its own, letters are typed: by the arrow
  await downSheet(input, on, 11)
  await on.shows(/▶ Old trek 11 /)
}

test("on a short terminal, the list scrolls to keep the selection in view", async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    name: `old-${String(i)}`,
    title: `Old trek ${String(i)}`,
    why: "merged",
  }))
  const frame = await frameAfter(
    <Landing
      load={() => Promise.resolve(choices)}
      pullRequests={() => Promise.resolve(open)}
      nearby={() => Promise.resolve(nearby)}
      repoBranches={() => Promise.resolve(apiBranches)}
      fetchRepo={fetchRepo}
      status={statusOf}
      pullStatus={pullStatusOf}
      entries={entries}
      done={() => Promise.resolve(many)}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    toLastDone,
    110,
    24,
  )

  expect(frame).toMatch(/▶ Old trek 11 +✓ merged/)
})

test("scrolled into a group, the list still shows the group's heading", async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    name: `old-${String(i)}`,
    title: `Old trek ${String(i)}`,
    why: "merged",
  }))
  const frame = await frameAfter(
    <Landing
      load={() => Promise.resolve(choices)}
      pullRequests={() => Promise.resolve(open)}
      nearby={() => Promise.resolve(nearby)}
      repoBranches={() => Promise.resolve(apiBranches)}
      fetchRepo={fetchRepo}
      status={statusOf}
      pullStatus={pullStatusOf}
      entries={entries}
      done={() => Promise.resolve(many)}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    toLastDone,
    110,
    20,
  )

  expect(frame).toMatch(/─\n\s*\n  done/)
})

test("waits for what's read here before drawing the list, saying so once it takes a while", async () => {
  const beside = deferred<NearbyCheckout[]>()
  let before = ""
  const whole = await frameAfter(
    <Landing
      load={() => Promise.resolve(choices)}
      pullRequests={() => Promise.resolve(open)}
      nearby={() => beside.promise}
      repoBranches={() => Promise.resolve(apiBranches)}
      fetchRepo={fetchRepo}
      status={statusOf}
      pullStatus={pullStatusOf}
      entries={entries}
      done={() => Promise.resolve(done)}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    async (_input, on) => {
      // the branches and done treks are in; the repos beside this one aren't yet
      before = await on.frame()
      await on.shows(/[◐◓◑◒] reading this repo…/)
      beside.resolve(nearby)
      await on.shows("feature/refunds")
    },
    110,
    34,
  )

  expect(before).not.toContain("feature/refunds")
  // a read that's quick enough never shows it's reading
  expect(before).not.toContain("reading")
  expect(before).toContain("srctrek")
  expect(before).toContain("?: keys")
  expect(whole).toContain("feature/refunds")
  expect(whole).toContain("d: 2 done treks")
})

test("a long title takes the room what the rows hold doesn't need before it's cut", async () => {
  const long: OpenPullRequest = {
    number: 12,
    title: "Split partial refunds across two payments when the first one fails",
    author: "alice",
    url: "https://github.com/acme/web/pull/12",
    draft: false,
    reviewRequested: false,
    mine: true,
    head: "c12",
    base: "main",
    updatedAt: "2026-11-23T10:00:00Z",
    commits: 3,
  }
  const frame = await frameAfter(
    landing({ pullRequests: () => Promise.resolve([long]) }),
    (_input, on) => on.shows("Split partial"),
    120,
    34,
  )

  expect(frame).toMatch(
    /#12 Split partial refunds across two payments when the first on… +3 commits  ¦  yours +● ready/,
  )
})

test("the table fills the row up to 120 columns, its states at the right edge; narrow, nothing wraps", async () => {
  const lineOf = (frame: string, name: string) =>
    frame.split("\n").find((line) => line.includes(name)) ?? ""
  const wide = await frameAfter(landing(), listed, 110, 34)
  const narrow = await frameAfter(landing(), (_input, on) => on.shows("its ways in"), 70, 34)

  // the longest state ends at the row's end
  expect(lineOf(wide, "feature/refunds").trimEnd()).toHaveLength(110 - 2)
  // on a very wide terminal, at 120 columns, so a state stays within a glance of its name
  const widest = await frameAfter(landing(), listed, 200, 34)
  expect(lineOf(widest, "feature/refunds").trimEnd()).toHaveLength(2 + 120)
  // a review asked for fits its column, the author given up first, the names cut so what they hold
  // keeps its room: the state where the others are
  expect(lineOf(narrow, "#12 Add").search(/●/)).toBe(lineOf(narrow, "feature/refunds").search(/●/))
  expect(narrow).toMatch(/#12 Add partial re… +review requested +● ready/)
  expect(narrow).not.toMatch(/\n {2}(yet|ready)/)
})

test("appears whole once the pull requests are in too, never without them first", async () => {
  const pulls = deferred<OpenPullRequest[]>()
  let before = ""
  const frame = await frameAfter(
    landing({ pullRequests: () => pulls.promise }),
    async (_input, on) => {
      // what's read here is in, and every trek's state; the host hasn't answered yet
      await on.shows("reading this repo")
      before = await on.frame()
      pulls.resolve(open)
      await on.shows(/\n  checked out/)
    },
    110,
    34,
  )

  expect(before).not.toMatch(/\n  checked out/)
  expect(frame).toContain("#12 Add partial refunds")
  expect(frame).toContain("p: 1 pull request")
  expect(frame).toMatch(/feature\/refunds +3 commits +● ready/)
})

test("a change being opened says so on its own row", async () => {
  const frame = await frameAfter(
    <Landing
      load={() => Promise.resolve(choices)}
      pullRequests={() => Promise.resolve(open)}
      nearby={() => Promise.resolve(nearby)}
      repoBranches={() => Promise.resolve(apiBranches)}
      fetchRepo={fetchRepo}
      status={statusOf}
      pullStatus={pullStatusOf}
      entries={entries}
      done={() => Promise.resolve(done)}
      opening={{ kind: "opening", choice: { kind: "branch", name: "fix/rounding" } }}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    (_input, on) => on.shows(/fix\/rounding +1 commit +[◐◓◑◒] opening…/),
    110,
    34,
  )

  expect(frame).toMatch(/feature\/refunds +3 commits +● ready/)
})

test("a change that couldn't be opened says why, until the next key", async () => {
  let before = ""
  const after = await frameAfter(
    <Landing
      load={() => Promise.resolve(choices)}
      pullRequests={() => Promise.resolve(open)}
      nearby={() => Promise.resolve(nearby)}
      repoBranches={() => Promise.resolve(apiBranches)}
      fetchRepo={fetchRepo}
      status={statusOf}
      pullStatus={pullStatusOf}
      entries={entries}
      done={() => Promise.resolve(done)}
      opening={{ kind: "failed", choice: own, why: "no such branch" }}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    async (input, on) => {
      await on.shows("✕ couldn't open your branch: no such branch")
      before = await on.frame()
      input.pressKey("j")
      await on.shows(/^(?![\s\S]*couldn't open)/)
    },
    110,
    34,
  )

  expect(before).toMatch(/\n  checked out/)
  expect(after).not.toContain("couldn't open")
})

test("reads the pull requests again while open, their rows following", async () => {
  let reads = 0
  const pullRequests = () => {
    reads += 1
    return Promise.resolve(
      reads === 1
        ? open
        : open.slice(0, 1).map((pr) => ({ ...pr, title: "Add partial refunds v2" })),
    )
  }
  const frame = await frameAfter(landing({ pullRequests, pullsEvery: 50 }), (_i, on) =>
    on.shows("Add partial refunds v2"),
  )

  expect(frame).not.toContain("#14 Round refunds")
})

// Others' work beside the user's: a pull request of theirs, one of someone else's, and a branch
// with no commit of the user's.
const mixedPulls: OpenPullRequest[] = [
  ...open,
  {
    number: 18,
    title: "Export refund rows",
    author: "test",
    url: "https://github.com/acme/web/pull/18",
    draft: false,
    reviewRequested: false,
    mine: true,
    head: "c18",
    base: "main",
    updatedAt: "2026-11-24T10:00:00Z",
    commits: 4,
  },
]
const mixedChoices: BranchChoices = {
  ...choices,
  others: [...choices.others, { name: "bo/tax", commits: 2, mine: false }],
}

test("lists only what's the user's: their pull requests and branches, the rest behind p and B", async () => {
  const frame = await frameAfter(
    landing({
      load: () => Promise.resolve(mixedChoices),
      pullRequests: () => Promise.resolve(mixedPulls),
    }),
    (_input, on) => on.shows("#18 Export refund rows"),
    120,
    30,
  )

  expect(frame).toMatch(/checked out[\s\S]*#18 Export refund rows +4 commits  ¦  yours/)
  expect(frame).toMatch(/#12 Add partial refunds +3 commits  ¦  review requested/)
  expect(frame).toMatch(/your branches 2\s+fix\/rounding/)
  expect(frame).not.toContain("#14 Round refunds")
  expect(frame).not.toContain("bo/tax")
  expect(frame).toContain("p: 1 pull request  ¦  B: 1 branch  ¦  d: 2 done treks")
  expect(frame).not.toContain("S: settings")
})

test("p lists the other pull requests on a view of their own", async () => {
  const frame = await frameAfter(
    landing({ pullRequests: () => Promise.resolve(mixedPulls) }),
    async (input, on) => {
      await on.shows("p: 1 pull request")
      input.pressKey("p")
      await on.shows("srctrek › pull requests")
    },
    120,
    30,
  )

  expect(frame).toContain("#14 Round refunds to cents")
  expect(frame).not.toContain("#12 Add partial refunds")
})

test("B lists the other branches on a view of their own: others', and the user's past the first 8", async () => {
  const yours = Array.from({ length: 9 }, (_, at) => ({
    name: `mine/${at}`,
    commits: 1,
    mine: true,
  }))
  const frame = await frameAfter(
    landing({
      load: () =>
        Promise.resolve({
          ...choices,
          others: [...yours, { name: "bo/tax", commits: 2, mine: false }],
        }),
    }),
    async (input, on) => {
      await on.shows("B: 2 branches")
      input.pressKey("B", { shift: true })
      await on.shows("srctrek › branches")
    },
    120,
    30,
  )

  expect(frame).toContain("mine/8")
  expect(frame).toContain("bo/tax")
  expect(frame).not.toContain("mine/7")
})

test("typing on a view of its own narrows it; esc clears what's typed, then goes back", async () => {
  const cache = open.map((pr) => ({ ...pr, number: 21, title: "Cache the provider config" }))
  const others: OpenPullRequest[] = [...open, ...cache.slice(1)]
  let narrowed = ""
  const frame = await frameAfter(
    landing({ pullRequests: () => Promise.resolve(others) }),
    async (input, on) => {
      await on.shows("p: 2 pull requests")
      input.pressKey("p")
      await on.shows("#21 Cache the provider config")
      await input.typeText("cache")
      await on.shows("/ cache")
      narrowed = await on.frame()
      input.pressEscape()
      await on.shows("#14 Round refunds")
      input.pressEscape()
      await on.shows("checked out")
    },
    120,
    30,
  )

  expect(narrowed).toContain("pull requests  ¦  1 of 2  / cache▏")
  expect(narrowed).toContain("#21 Cache the provider config")
  expect(narrowed).not.toContain("#14 Round refunds")
  expect(narrowed).toContain("type: narrow  ¦  ↵: open  ¦  esc: clear")
  expect(frame).toContain("p: 2 pull requests")
})
