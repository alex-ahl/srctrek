import { expect, mock, test } from "bun:test"
import type {
  BranchChoices,
  ChangeChoice,
  NearbyCheckout,
  OpenPullRequest,
  RepoBranch,
  RepoBranches,
  TrekStatus,
} from "@srctrek/core"
import { dropRows, opened } from "../../src/landing/drop"
import { type DoneTrek, type Pick, landingRows, pullRequestRows } from "../../src/landing/rows"
import { Landing } from "../../src/landing/screen"
import { deferred } from "../support/deferred"
import { type Screen, frameAfter } from "../support/keys"

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

const done: DoneTrek[] = [
  { name: "feature-coupons", title: "Applying a coupon", why: "merged" },
  { name: "spike-ledger", title: "Posting to the ledger", why: "branch gone" },
]

// The user's own branch has a trek; fix/rounding has none, nor has the code its ways in; the rest
// haven't answered yet.
function statusOf(choice: ChangeChoice): Promise<TrekStatus> {
  if (choice.kind === "own" && !choice.uncommitted) {
    return Promise.resolve({ kind: "ready", name: "feature-refunds" })
  }

  if (choice.kind === "code") {
    return Promise.resolve({ kind: "missing", name: "web" })
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

type Setup = Partial<{
  onPick: (pick: Pick) => void
  onSettings: () => void
  onQuit: () => void
  pullRequests: () => Promise<OpenPullRequest[]>
  repoBranches: (path: string) => Promise<RepoBranches>
  from: Pick
}>

function landing(setup: Setup = {}) {
  return (
    <Landing
      load={() => Promise.resolve(choices)}
      pullRequests={setup.pullRequests ?? (() => Promise.resolve(open))}
      nearby={() => Promise.resolve(nearby)}
      repoBranches={setup.repoBranches ?? (() => Promise.resolve(apiBranches))}
      fetchRepo={fetchRepo}
      status={statusOf}
      done={() => Promise.resolve(done)}
      from={setup.from}
      onPick={setup.onPick ?? (() => undefined)}
      onSettings={setup.onSettings ?? (() => undefined)}
      onQuit={setup.onQuit ?? (() => undefined)}
      tint={undefined}
    />
  )
}

type Input = Parameters<Parameters<typeof frameAfter>[1]>[0]

// Everything listed: own work, the pull requests, the branches, code, the repos, and done.
const listed = async (_input: Input, on: Screen) => {
  await on.shows("#14 Round refunds")
  await on.shows("▸ 2 more repos")
  await on.shows("▸ DONE  2")
}

// Down `times` rows, a draw after each, so each lands before the next.
async function down(input: Input, on: Screen, times: number) {
  for (const _ of Array.from({ length: times })) {
    input.pressKey("j")
    await on.drawn()
  }
}

test("offers the user's own work first, then the other branches, each saying what it opens", () => {
  const rows = landingRows(choices, open)

  expect(rows.map((row) => [row.group, row.label, row.detail])).toEqual([
    ["YOUR WORK", "feature/refunds", "3 commits since main"],
    ["YOUR WORK", "with uncommitted work", "2 files changed"],
    ["WAITING ON YOUR REVIEW", "#12 Add partial refunds", "alice · review requested"],
    ["OTHER PULL REQUESTS", "#14 Round refunds to cents", "bo · draft"],
    ["OTHER BRANCHES", "fix/rounding", "1 commit since main"],
    ["OTHER BRANCHES", "feature/partial-refunds", "5 commits since main"],
    ["CODE AS IT IS", "its ways in", "routes, events, and commands to follow"],
  ])
  expect(rows[1]?.opens).toBe("feature/refunds with 2 files not yet committed")
})

test("leaves out the uncommitted row when everything is committed", () => {
  const labels = landingRows({ ...choices, uncommittedFiles: 0 }, []).map((row) => row.label)

  expect(labels).not.toContain("with uncommitted work")
})

test("offers the open pull requests by number and title, with who opened them and what waits", () => {
  const rows = pullRequestRows(open)

  expect(rows.map((row) => [row.group, row.label, row.detail])).toEqual([
    ["WAITING ON YOUR REVIEW", "#12 Add partial refunds", "alice · review requested"],
    ["OTHER PULL REQUESTS", "#14 Round refunds to cents", "bo · draft"],
  ])
  expect(rows[0]?.opens).toBe("pr 12 · Add partial refunds · by alice")
})

test("opens on the user's own branch, every change under its heading", async () => {
  const frame = await frameAfter(landing(), listed, 110, 34)

  expect(frame).toMatch(/YOUR WORK\s+▶ +feature\/refunds +3 commits since main/)
  expect(frame).toMatch(/WAITING ON YOUR REVIEW\s+#12 Add partial refunds/)
  expect(frame).toMatch(/OTHER PULL REQUESTS\s+#14 Round refunds to cents/)
  expect(frame).toMatch(/OTHER BRANCHES\s+fix\/rounding/)
  expect(frame).toMatch(/CODE AS IT IS\s+its ways in/)
  expect(frame).toContain("MORE REPOS")
  expect(frame).toContain("▸ DONE  2")
  expect(frame).toContain("Opens: feature/refunds · 3 commits since main")
  expect(frame).toContain("enter open · S settings · ? keys")
})

test("says on each row whether a trek of it exists, as each is worked out", async () => {
  const frame = await frameAfter(landing(), (_input, on) => on.shows("○ no trek yet"))

  expect(frame).toMatch(/feature\/refunds +3 commits since main +● trek ready/)
  expect(frame).toMatch(/fix\/rounding +1 commit since main +○ no trek yet/)
  expect(frame).toMatch(/feature\/partial-refunds +5 commits since main +… *\n/)
})

test("enter opens the selected change", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 4)
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

test("says when nothing waits on your review, or why pull requests can't be listed", async () => {
  const none = await frameAfter(landing({ pullRequests: () => Promise.resolve([]) }), (_i, on) =>
    on.shows("nothing waiting on your review"),
  )
  const failed = await frameAfter(
    landing({ pullRequests: () => Promise.reject(new Error("gh: not logged in")) }),
    (_i, on) => on.shows("✕ gh: not logged in"),
  )

  expect(none).toMatch(/WAITING ON YOUR REVIEW\s+nothing waiting on your review/)
  expect(failed).toMatch(/WAITING ON YOUR REVIEW\s+✕ gh: not logged in/)
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
    await on.shows("#14 Round refunds")
    input.pressEnter()
  })

  expect(onPick).toHaveBeenCalledWith({ kind: "branch", name: "fix/rounding" })
})

test("opens on what was opened from it last, its repos ticked", async () => {
  const api = { path: "../api", changed: true }
  const frame = await frameAfter(
    landing({ from: { kind: "branch", name: "fix/rounding", repos: [api] } }),
    listed,
    110,
    34,
  )

  expect(frame).toContain("Opens: fix/rounding · 1 commit since main, refunds-api in api")
  expect(frame).toMatch(/\[x\] api/)
})

test("enter on the done fold lists the treks whose work has landed, and opens one", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  const frame = await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 9)
      input.pressEnter()
      await on.shows("Applying a coupon")
      input.pressEnter()
    },
    110,
    40,
  )

  expect(frame).toMatch(/DONE\s+▶ +Applying a coupon +merged/)
  expect(frame).toMatch(/Posting to the ledger +branch gone/)
  expect(onPick).toHaveBeenCalledWith({ kind: "trek", name: "feature-coupons", why: "merged" })
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

test("lists the repos with work beside this one, folding the rest under a count", async () => {
  const frame = await frameAfter(landing(), listed, 110, 34)

  expect(frame).toMatch(/\[ \] api +\.\.\/api +refunds-api +4 commits/)
  expect(frame).toContain("▸ 2 more repos")
  expect(frame).not.toContain("worker")
})

test("space ticks a repo, which goes along with the change enter opens", async () => {
  const onPick = mock((_pick: Pick) => undefined)
  const frame = await frameAfter(
    landing({ onPick }),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 7)
      input.pressKey(" ")
      await on.shows("[x] api")
      for (const _ of Array.from({ length: 7 })) {
        input.pressKey("k")
        await on.drawn()
      }
      input.pressEnter()
    },
    110,
    34,
  )

  expect(frame).toContain("Opens: feature/refunds · 3 commits since main, refunds-api in api")
  expect(onPick).toHaveBeenCalledWith({ ...own, repos: [{ path: "../api", changed: true }] })
})

test("enter on the repos' fold lists the rest, and a repo on its default branch is passed through", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 8)
      input.pressEnter()
      await on.shows("worker")
      await down(input, on, 1)
      input.pressKey(" ")
      await on.shows("[x] worker")
    },
    110,
    34,
  )

  expect(frame).toMatch(/\[x\] worker +\.\.\/worker +main ▸ +passed through/)
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

// The landing with api's branches open.
const openDrop = async (input: Input, on: Screen) => {
  await listed(input, on)
  await down(input, on, 7)
  input.pressArrow("right")
  await on.shows("┌")
}

test("→ on a repo opens its branches under it, with when, who, and what", async () => {
  const frame = await frameAfter(landing(), openDrop, 120, 40)

  expect(frame).toMatch(/┌ refunds-v2 +2h ago +alice +Split partial refunds into their own handler/)
  expect(frame).toMatch(/│ refunds-api +3d ago +you +Work on refunds-api +checked out/)
  expect(frame).toContain("▸ 1 more branches")
  expect(frame).toMatch(/│ main +its default branch · passes it through/)
  expect(frame).toContain("└ ↻ look for new branches on the remote")
  expect(frame).toContain("type to narrow · enter take · ←/esc close")
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

  expect(frame).toMatch(/\[x\] api +\.\.\/api +main ▸ +passed through · you have refunds-api out/)
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

test("← closes a repo's branches without taking one", async () => {
  const frame = await frameAfter(
    landing(),
    async (input, on) => {
      await openDrop(input, on)
      input.pressArrow("left")
      await on.drawn()
    },
    120,
    40,
  )

  expect(frame).not.toContain("┌")
  expect(frame).toMatch(/\[ \] api +\.\.\/api +refunds-api ▸/)
})

test("says why a repo's branches couldn't be read, instead of waiting for them", async () => {
  const frame = await frameAfter(
    landing({ repoBranches: () => Promise.reject(new Error("no base branch")) }),
    async (input, on) => {
      await listed(input, on)
      await down(input, on, 7)
      input.pressArrow("right")
      await on.shows("✕ no base branch")
    },
    120,
    40,
  )

  expect(frame).toContain("└ ✕ no base branch")
  expect(frame).not.toContain("finding branches")
})

test("a ticked repo that isn't beside this one stays listed, and goes along with a pick", async () => {
  const billing = { path: "../../work/billing", changed: true, branch: "invoices" }
  const onPick = mock((_pick: Pick) => undefined)
  const frame = await frameAfter(
    landing({ onPick, from: { ...own, repos: [billing] } }),
    async (input, on) => {
      await listed(input, on)
      input.pressEnter()
    },
    110,
    40,
  )

  expect(frame).toMatch(/\[x\] billing +\.\.\/\.\.\/work\/billing +invoices/)
  expect(onPick).toHaveBeenCalledWith({ ...own, repos: [billing] })
})

test("code as it is says where finding its ways in stands, not a trek's state", async () => {
  const frame = await frameAfter(landing(), (_input, on) => on.shows("ways in not found yet"))

  expect(frame).toMatch(
    /its ways in +routes, events, and commands to follow +○ ways in not found yet/,
  )
})

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
      done={() => Promise.resolve(many)}
      from={{ kind: "trek", name: "old-11", why: "merged" }}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    (_input, on) => on.shows("Opens: Old trek 11"),
    110,
    24,
  )

  expect(frame).toMatch(/▶ +Old trek 11 +merged/)
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
      done={() => Promise.resolve(many)}
      from={{ kind: "trek", name: "old-11", why: "merged" }}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    (_input, on) => on.shows("Opens: Old trek 11"),
    110,
    20,
  )

  expect(frame).toMatch(/─\n\s*\n  DONE/)
})

test("waits for what's read here before drawing the list, then draws it whole", async () => {
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
      done={() => Promise.resolve(done)}
      from={undefined}
      onPick={() => undefined}
      onSettings={() => undefined}
      onQuit={() => undefined}
      tint={undefined}
    />,
    async (_input, on) => {
      // the branches and done treks are in; the repos beside this one aren't yet
      before = await on.frame()
      beside.resolve(nearby)
      await on.shows("[ ] api")
    },
    110,
    34,
  )

  expect(before).not.toContain("feature/refunds")
  expect(whole).toContain("feature/refunds")
  expect(whole).toContain("▸ DONE  2")
})

test("the columns stay where they are as pull requests with long titles arrive", async () => {
  const pulls = deferred<OpenPullRequest[]>()
  const long: OpenPullRequest = {
    number: 12,
    title: "Split partial refunds across two payments when the first one fails",
    author: "alice",
    url: "https://github.com/acme/web/pull/12",
    draft: false,
    reviewRequested: false,
  }
  const stateAt = (frame: string) =>
    frame
      .split("\n")
      .find((line) => line.includes("feature/refunds"))
      ?.indexOf("● trek ready")
  let before = ""
  const after = await frameAfter(
    landing({ pullRequests: () => pulls.promise }),
    async (_input, on) => {
      await on.shows("● trek ready")
      before = await on.frame()
      pulls.resolve([long])
      await on.shows("Split partial")
    },
    120,
    34,
  )

  expect(stateAt(after)).toBe(stateAt(before))
})
