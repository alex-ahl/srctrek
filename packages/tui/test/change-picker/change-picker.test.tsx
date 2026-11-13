import { expect, mock, test } from "bun:test"
import type {
  BranchChoices,
  RepoBranch,
  RepoBranches,
  ChangeChoice,
  NearbyCheckout,
  OpenPullRequest,
  TrekStatus,
} from "@srctrek/core"
import { App } from "../../src/home/app"
import { dropRows, opened } from "../../src/change-picker/drop"
import { pickerRows, pullRequestRows } from "../../src/change-picker/rows"
import { frameAfter } from "../support/keys"

const choices: BranchChoices = {
  base: "main",
  own: { name: "feature/refunds", commits: 3 },
  uncommittedFiles: 2,
  others: [
    { name: "fix/rounding", commits: 1 },
    { name: "feature/partial-refunds", commits: 5 },
  ],
}

const own: ChangeChoice = { kind: "own", uncommitted: false }

// The user's own branch has a trek; fix/rounding has none; the rest haven't answered yet.
function statusOf(choice: ChangeChoice): Promise<TrekStatus> {
  if (choice.kind === "own" && !choice.uncommitted) {
    return Promise.resolve({ kind: "ready", name: "feature-refunds" })
  }

  const none: TrekStatus = { kind: "missing", name: "fix-rounding" }
  return choice.kind === "branch" && choice.name === "fix/rounding"
    ? Promise.resolve(none)
    : new Promise(() => undefined)
}

const open: OpenPullRequest[] = [
  {
    number: 12,
    title: "Add partial refunds",
    author: "alice",
    url: "https://github.com/acme/web/pull/12",
    draft: false,
    reviewRequested: true,
  },
  {
    number: 14,
    title: "Round refunds to cents",
    author: "bo",
    url: "https://github.com/acme/web/pull/14",
    draft: true,
    reviewRequested: false,
  },
]

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

function app(
  onPick: (choice: ChangeChoice) => void,
  pullRequests: () => Promise<OpenPullRequest[]> = () => Promise.resolve(open),
) {
  const choosing = {
    choice: own,
    load: () => Promise.resolve(choices),
    pullRequests,
    nearby: () => Promise.resolve(nearby),
    repoBranches: () => Promise.resolve(apiBranches),
    fetchRepo,
    status: statusOf,
    onPick,
  }
  return <App entries={[]} onOpen={() => undefined} onQuit={() => undefined} choosing={choosing} />
}

const openPicker = async (input: {
  pressKey: (key: string, mods?: { shift: boolean }) => void
}) => {
  input.pressKey("C", { shift: true })
  await Bun.sleep(30)
}

test("offers the user's own work first, then the other branches, each saying what it opens", () => {
  const rows = pickerRows(choices)

  expect(rows.map((row) => [row.group, row.label, row.detail])).toEqual([
    ["YOUR WORK", "feature/refunds", "3 commits since main"],
    ["YOUR WORK", "with uncommitted work", "2 files changed"],
    ["OTHER BRANCHES", "fix/rounding", "1 commit since main"],
    ["OTHER BRANCHES", "feature/partial-refunds", "5 commits since main"],
  ])
  expect(rows[1]?.opens).toBe("feature/refunds with 2 files not yet committed")
})

test("leaves out the uncommitted row when everything is committed", () => {
  const labels = pickerRows({ ...choices, uncommittedFiles: 0 }).map((row) => row.label)

  expect(labels).not.toContain("with uncommitted work")
})

test("C opens the picker on the user's own branch, marking the change chosen now", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    openPicker,
  )

  expect(frame).toContain("srctrek › change")
  expect(frame).toContain("YOUR WORK")
  expect(frame).toMatch(/● feature\/refunds +3 commits since main/)
  expect(frame).toContain("OTHER BRANCHES")
  expect(frame).toContain("Opens: feature/refunds · 3 commits since main")
  expect(frame).toContain("enter review this · esc keep current")
})

test("enter picks the selected change", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  await frameAfter(app(onPick), async (input) => {
    await openPicker(input)
    input.pressKey("j")
    input.pressKey("j")
    await Bun.sleep(20)
    input.pressEnter()
    await Bun.sleep(20)
  })

  expect(onPick).toHaveBeenCalledWith({ kind: "branch", name: "fix/rounding" })
})

test("esc keeps the current change and goes back to the list", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  const frame = await frameAfter(app(onPick), async (input) => {
    await openPicker(input)
    input.pressEscape()
    await Bun.sleep(20)
  })

  expect(onPick).not.toHaveBeenCalled()
  expect(frame).not.toContain("srctrek › change")
  expect(frame).toContain("C change")
})

test("says on each row whether a trek of it exists, as each is worked out", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    openPicker,
  )

  expect(frame).toMatch(/feature\/refunds +3 commits since main +● trek ready/)
  expect(frame).toMatch(/fix\/rounding +1 commit since main +○ no trek yet/)
  expect(frame).toMatch(/feature\/partial-refunds +5 commits since main *\n/)
})

test("offers the open pull requests by number and title, with who opened them and what waits", () => {
  const rows = pullRequestRows(open)

  expect(rows.map((row) => [row.label, row.detail])).toEqual([
    ["#12 Add partial refunds", "alice · review requested"],
    ["#14 Round refunds to cents", "bo · draft"],
  ])
  expect(rows[0]?.opens).toBe("pr 12 · Add partial refunds · by alice")
})

test("lists pull requests after the branches, and picking one picks it by its link", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  await frameAfter(app(onPick), async (input) => {
    await openPicker(input)
    // the pull requests load apart from the branches; moving before they're listed stops short
    await Bun.sleep(150)
    for (const _ of [1, 2, 3, 4]) {
      input.pressKey("j")
    }
    await Bun.sleep(20)
    input.pressEnter()
    await Bun.sleep(20)
  })

  expect(onPick).toHaveBeenCalledWith({
    kind: "pull-request",
    url: "https://github.com/acme/web/pull/12",
  })
})

test("says when there are no open pull requests, or why they can't be listed", async () => {
  const none = await frameAfter(
    app(
      () => undefined,
      () => Promise.resolve([]),
    ),
    openPicker,
  )
  const failed = await frameAfter(
    app(
      () => undefined,
      () => Promise.reject(new Error("gh: not logged in")),
    ),
    openPicker,
  )

  expect(none).toContain("no open pull requests")
  expect(failed).toContain("✕ gh: not logged in")
})

// The picker open with everything listed: 4 changes, 2 pull requests, then api and the fold.
const openListed = async (input: Parameters<typeof openPicker>[0]) => {
  await openPicker(input)
  await Bun.sleep(150)
}

const down = (input: { pressKey: (key: string) => void }, times: number) => {
  for (const _ of Array.from({ length: times })) {
    input.pressKey("j")
  }
}

test("lists the repos with work beside this one, folding the rest under a count", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    openListed,
    110,
    30,
  )

  expect(frame).toContain("MORE REPOS")
  expect(frame).toMatch(/\[ \] api +\.\.\/api +refunds-api +4 commits/)
  expect(frame).toContain("▸ 2 more repos")
  expect(frame).not.toContain("worker")
})

test("space ticks a repo, which goes along with the change enter opens", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  const frame = await frameAfter(
    app(onPick),
    async (input) => {
      await openListed(input)
      down(input, 6)
      await Bun.sleep(20)
      input.pressKey(" ")
      await Bun.sleep(20)
    },
    110,
    30,
  )

  expect(frame).toMatch(/\[x\] api/)
  expect(frame).toContain("Opens: feature/refunds · 3 commits since main, refunds-api in api")
})

test("enter on a repo opens the current change with the ticked repos", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  await frameAfter(app(onPick), async (input) => {
    await openListed(input)
    down(input, 6)
    await Bun.sleep(20)
    input.pressKey(" ")
    await Bun.sleep(20)
    input.pressEnter()
    await Bun.sleep(20)
  })

  expect(onPick).toHaveBeenCalledWith({ ...own, repos: [{ path: "../api", changed: true }] })
})

test("enter on the fold lists the rest, and a repo on its default branch is passed through", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    async (input) => {
      await openListed(input)
      down(input, 7)
      await Bun.sleep(20)
      input.pressEnter()
      await Bun.sleep(20)
      down(input, 2)
      await Bun.sleep(20)
      input.pressKey(" ")
      await Bun.sleep(20)
    },
    110,
    30,
  )

  expect(frame).toMatch(/\[x\] worker +\.\.\/worker +main ▸ +passed through/)
  expect(frame).toContain("· worker passed through")
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

// The picker open on api's branches.
const openDrop = async (input: Parameters<Parameters<typeof frameAfter>[1]>[0]) => {
  await openListed(input)
  down(input, 6)
  await Bun.sleep(20)
  input.pressArrow("right")
  await Bun.sleep(50)
}

test("→ on a repo opens its branches under it, with when, who, and what", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    openDrop,
    120,
    34,
  )

  expect(frame).toMatch(/┌ refunds-v2 +2h ago +alice +Split partial refunds into their own handler/)
  expect(frame).toMatch(/│ refunds-api +3d ago +you +Work on refunds-api +checked out/)
  expect(frame).toContain("▸ 1 more branches")
  expect(frame).toMatch(/│ main +its default branch · passes it through/)
  expect(frame).toContain("└ ↻ look for new branches on the remote")
  expect(frame).toContain("type to narrow · ↑/↓ choose · enter take · ←/esc close")
})

test("enter takes a branch, ticking the repo on it", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    async (input) => {
      await openDrop(input)
      input.pressEnter()
      await Bun.sleep(20)
    },
    120,
    34,
  )

  expect(frame).toMatch(/\[x\] api +\.\.\/api +refunds-v2 ▸ +you have refunds-api out/)
  expect(frame).toContain("refunds-v2 in api")
  expect(frame).not.toContain("┌")
})

test("typed letters narrow the open branches; the default branch passes the repo through", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    async (input) => {
      await openDrop(input)
      input.pressKey("m")
      input.pressKey("a")
      await Bun.sleep(30)
      input.pressEnter()
      await Bun.sleep(20)
    },
    120,
    34,
  )

  expect(frame).toMatch(/\[x\] api +\.\.\/api +main ▸ +passed through · you have refunds-api out/)
})

test("the fetch line fetches the repo, then lists its branches again", async () => {
  fetchRepo.mockClear()
  await frameAfter(
    app(() => undefined),
    async (input) => {
      await openDrop(input)
      for (const _ of Array.from({ length: 6 })) {
        input.pressArrow("down")
      }
      await Bun.sleep(20)
      input.pressEnter()
      await Bun.sleep(50)
    },
    120,
    34,
  )

  expect(fetchRepo).toHaveBeenCalledWith("../api")
})

test("← closes a repo's branches without taking one", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    async (input) => {
      await openDrop(input)
      input.pressArrow("left")
      await Bun.sleep(20)
    },
    120,
    34,
  )

  expect(frame).not.toContain("┌")
  expect(frame).toMatch(/\[ \] api +\.\.\/api +refunds-api ▸/)
})

test("says why a repo's branches couldn't be read, instead of waiting for them", async () => {
  const choosing = {
    choice: own,
    load: () => Promise.resolve(choices),
    pullRequests: () => Promise.resolve(open),
    nearby: () => Promise.resolve(nearby),
    repoBranches: () => Promise.reject(new Error("no base branch")),
    fetchRepo,
    status: statusOf,
    onPick: () => undefined,
  }
  const frame = await frameAfter(
    <App entries={[]} onOpen={() => undefined} onQuit={() => undefined} choosing={choosing} />,
    openDrop,
    120,
    34,
  )

  expect(frame).toContain("└ ✕ no base branch")
  expect(frame).not.toContain("finding branches")
})
