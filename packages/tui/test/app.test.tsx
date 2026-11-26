import { expect, mock, test } from "bun:test"
import type {
  BranchChoices,
  OpenPullRequest,
  ChangeChoice,
  ChangeSummary,
  PullRequestDetails,
  Settings,
  TrekStatus,
} from "@srctrek/core"
import { repoWithTrek } from "@srctrek/testing"
import { App, type Opening } from "../src/app"
import type { OpenChange } from "../src/change/open-change"
import { overviewOf } from "../src/change/overview"
import type { Sources } from "../src/sources"
import { deferred } from "./support/deferred"
import { type Screen, frameAfter } from "./support/keys"

type Input = Parameters<Parameters<typeof frameAfter>[1]>[0]

const choices: BranchChoices = {
  base: "main",
  own: { name: "feature/refunds", commits: 3 },
  uncommittedFiles: 0,
  others: [{ name: "fix/rounding", commits: 1, mine: true }],
}

const summary: ChangeSummary = {
  changed: [
    {
      repo: "web",
      base: "main",
      head: { kind: "branch", name: "feature/refunds", uncommitted: false },
      commits: 3,
      files: 5,
    },
  ],
  unchanged: [],
  code: false,
}

const changeWith = (status: () => Promise<TrekStatus>): OpenChange => ({ summary, status })

const missing: TrekStatus = { kind: "missing", name: "feature-refunds" }
const ready: TrekStatus = { kind: "ready", name: "pay" }

function sources(more: Partial<Sources> = {}): Sources {
  return {
    load: () => Promise.resolve(choices),
    pullRequests: () => Promise.resolve([]),
    pullRequest: () => Promise.reject(new Error("no pull requests here")),
    overview: () => Promise.resolve(undefined),
    nearby: () => Promise.resolve([]),
    repoBranches: () => Promise.reject(new Error("no branches here")),
    fetchRepo: () => Promise.resolve(),
    status: () => Promise.resolve(missing),
    pullStatus: () => Promise.resolve(missing),
    done: () => Promise.resolve([]),
    open: () => Promise.resolve(changeWith(() => Promise.resolve(missing))),
    stamp: () => Promise.resolve("still"),
    entries: () => Promise.resolve([]),
    proposals: () => Promise.resolve([]),
    addRepo: () => Promise.resolve(),
    dismissRepo: () => Promise.resolve(),
    stopBuild: () => Promise.resolve(),
    readBuild: () =>
      Promise.resolve({
        log: [],
        steps: [],
        state: undefined,
        started: undefined,
        ended: undefined,
        count: 0,
      }),
    ...more,
  }
}

// Narrower than the split, a change opens on a screen of its own.
const NARROW = 100

const narrow = (
  node: Parameters<typeof frameAfter>[0],
  press: Parameters<typeof frameAfter>[1],
  height?: number,
) => frameAfter(node, press, NARROW, height)

const LANDING: Opening = { kind: "landing" }

// How often the user's own branch was opened, whose args are none: the other changes listed are
// worked out ahead too.
const ownOpened = (open: { mock: { calls: string[][][] } }) =>
  open.mock.calls.filter(([args]) => args?.length === 0).length
const own: ChangeChoice = { kind: "own", uncommitted: false }

// The landing page and screens over the repo at `root`, its saved treks' overviews read there.
function app(
  root: string,
  opening: Opening,
  from: Sources = sources({ overview: (name) => overviewOf(root, name) }),
  settings: Settings = {},
) {
  return (
    <App
      root={root}
      opening={opening}
      sources={from}
      firstSettings={settings}
      editors={[]}
      onQuit={() => undefined}
    />
  )
}

// Waits for escape, which reaches the screen once the terminal's wait for a longer sequence is over.
async function escape(input: Input, on: Screen, then: string) {
  input.pressEscape()
  await on.shows(then)
}

test("with nothing asked for, opens on the landing page", async () => {
  const frame = await narrow(app(".", LANDING), (_input, on) => on.shows("your work"))

  expect(frame).toContain("feature/refunds")
})

test("enter on a change opens its screen, and esc goes back to the landing page", async () => {
  const open = mock((_args: string[]) =>
    Promise.resolve(changeWith(() => Promise.resolve(missing))),
  )
  const frame = await narrow(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    await on.shows("no trek yet")
    await escape(input, on, "your work")
  })

  expect(open).toHaveBeenCalledWith([])
  expect(frame).toContain("your work")
})

test("going to a change and back doesn't ask for the pull requests again", async () => {
  const pullRequests = mock(() => Promise.resolve([]))
  await narrow(app(".", LANDING, sources({ pullRequests })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    await on.shows("no trek yet")
    await escape(input, on, "your work")
  })

  expect(pullRequests).toHaveBeenCalledTimes(1)
})

test("a pick still being worked out doesn't open over a screen opened meanwhile", async () => {
  const opened = deferred<OpenChange>()
  const asked = deferred<undefined>()
  const open = () => {
    asked.resolve(undefined)
    return opened.promise
  }
  const frame = await narrow(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    await asked.promise
    input.pressKey("S", { shift: true })
    await on.shows("srctrek › settings")
    opened.resolve(changeWith(() => Promise.resolve(missing)))
    await opened.promise
    await on.drawn()
  })

  expect(frame).toContain("srctrek › settings")
  expect(frame).not.toContain("no trek yet")
})

test("a change asked for opens on its screen, and esc goes to the landing page", async () => {
  const change = changeWith(() => Promise.resolve(missing))
  const opening: Opening = { kind: "change", choice: own, change, status: missing }
  const frame = await narrow(app(".", opening), async (input, on) => {
    await on.shows("no trek yet")
    await escape(input, on, "your work")
  })

  expect(frame).toContain("pull requests")
})

test("enter steps a ready trek from its first stop, and q comes back to the change", async () => {
  const root = await repoWithTrek()
  const change = changeWith(() => Promise.resolve(ready))
  const opening: Opening = { kind: "change", choice: own, change, status: ready }
  const frame = await narrow(
    app(root, opening),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressEnter()
      await on.shows("1 / 3")
      input.pressKey("q")
      await on.shows("3 stops")
    },
    30,
  )

  expect(frame).toContain("● ready")
})

test("a done trek opens on a screen of its own", async () => {
  const root = await repoWithTrek()
  const done = () => Promise.resolve([{ name: "pay", title: "Pay", why: "merged" }])
  const frame = await narrow(
    app(root, LANDING, sources({ done, overview: (name) => overviewOf(root, name) })),
    async (input, on) => {
      await on.shows("d: 1 done trek")
      input.pressKey("d")
      await on.shows("merged")
      input.pressEnter()
      await on.shows("3 stops")
    },
    30,
  )

  expect(frame).toContain("main pays through a helper.")
})

test("S opens settings from the landing page, and esc comes back", async () => {
  const frame = await narrow(app(".", LANDING), async (input, on) => {
    await on.shows("your work")
    input.pressKey("S", { shift: true })
    await on.shows("srctrek › settings")
    await escape(input, on, "your work")
  })

  expect(frame).not.toContain("srctrek › settings")
})

test("a change that can't be opened says why on the landing page, which stays", async () => {
  const open = () => Promise.reject(new Error("no such branch"))
  const frame = await narrow(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    await on.shows("no such branch")
  })

  expect(frame).toContain("✕ couldn't open your branch: no such branch")
  expect(frame).toContain("your work")
})

test("a change that takes a while to open says so on the landing page, then comes up whole", async () => {
  const opened = deferred<OpenChange>()
  const open = () => opened.promise
  await narrow(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    await on.shows(/feature\/refunds .*[◐◓◑◒] opening…/)
    expect(await on.frame()).toContain("your work")
    opened.resolve(changeWith(() => Promise.resolve(missing)))
    await on.shows("no trek yet")
  })
})

test("the worktree moving on reopens the change, and its trek shows as it now stands", async () => {
  const root = await repoWithTrek()
  let saved = false
  const status = () => Promise.resolve(saved ? ready : missing)
  const open = () => Promise.resolve(changeWith(status))
  const stamp = () => Promise.resolve(saved ? "saved" : "before")
  const opening: Opening = {
    kind: "change",
    choice: own,
    change: changeWith(status),
    status: missing,
  }
  const frame = await narrow(
    app(root, opening, sources({ open, stamp, overview: (name) => overviewOf(root, name) })),
    async (_input, on) => {
      await on.shows("no trek yet")
      saved = true
      await on.shows("3 stops")
    },
    30,
  )

  expect(frame).toContain("● ready")
})

test("back on a change's screen, its trek shows as it last stood, not as it first opened", async () => {
  const root = await repoWithTrek()
  // read once, as the screen first opens; never again, so the screen can't catch up by reading
  let reads = 0
  const status = () =>
    reads++ === 0 ? Promise.resolve(ready) : new Promise<TrekStatus>(() => undefined)
  const opening: Opening = {
    kind: "change",
    choice: own,
    change: changeWith(status),
    status: missing,
  }
  const frame = await narrow(
    app(root, opening),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressEnter()
      await on.shows("1 / 3")
      input.pressKey("q")
      await on.shows("3 stops")
    },
    30,
  )

  expect(frame).toContain("● ready")
})

const building: TrekStatus = { kind: "building", name: "feature-refunds", logTail: [] }

test("b on a change shows its build as soon as it starts", async () => {
  let started = false
  const build = () => {
    started = true
    return Promise.resolve()
  }
  const change: OpenChange = {
    summary,
    status: () => Promise.resolve(started ? building : missing),
    build,
  }
  const opening: Opening = { kind: "change", choice: own, change, status: missing }
  const frame = await narrow(app(".", opening), async (input, on) => {
    await on.shows("no trek yet")
    input.pressKey("b")
    await on.shows("◐ building")
  })

  expect(frame).not.toContain("no trek yet")
})

test("a build that ends with a trek shows it ready, without a key", async () => {
  const root = await repoWithTrek()
  const change = changeWith(() => Promise.resolve(ready))
  const opening: Opening = {
    kind: "change",
    choice: own,
    change,
    status: { ...building, name: "pay" },
  }
  const frame = await narrow(app(root, opening), (_input, on) => on.shows("3 stops"), 30)

  expect(frame).toContain("● ready")
})

test("a repo the agent proposes, once added, leaves the change's screen", async () => {
  const billing = {
    name: "billing",
    source: "../billing",
    reason: "refunds post to the ledger in billing",
    evidence: [{ repo: "web", file: "ledger.ts", line: 3 }],
  }
  let added = false
  const proposals = () => Promise.resolve(added ? [] : [billing])
  const addRepo = () => {
    added = true
    return Promise.resolve()
  }
  const change = changeWith(() => Promise.resolve(building))
  const opening: Opening = { kind: "change", choice: own, change, status: building }
  const frame = await narrow(
    app(".", opening, sources({ proposals, addRepo })),
    async (input, on) => {
      await on.shows("the agent went into billing")
      input.pressKey("y")
      await on.shows(/^(?![\s\S]*went into billing)/)
    },
  )

  expect(frame).toContain("◐ building")
})

test("code as it is, its ways in found, lists them; esc goes to the landing page", async () => {
  const code: ChangeSummary = { changed: [], unchanged: ["web"], code: true }
  const found: TrekStatus = {
    kind: "triggers",
    name: "web-code",
    triggers: [
      {
        trigger: {
          kind: "request",
          name: "POST /refunds",
          evidence: { repo: "web", file: "routes.ts", line: 12 },
        },
        trek: { kind: "missing", name: "web-post-refunds" },
      },
    ],
  }
  const change: OpenChange = { summary: code, status: () => Promise.resolve(found) }
  const opening: Opening = { kind: "change", choice: { kind: "code" }, change, status: found }
  const frame = await narrow(app(".", opening), async (input, on) => {
    await on.shows("POST /refunds")
    await escape(input, on, "your work")
  })

  expect(frame).toContain("code as it is")
})

test("a pull request's screen names it by its title, and who opened it", async () => {
  const url = "https://github.com/acme/web/pull/12"
  const pull: ChangeSummary = {
    changed: [
      { repo: "web", base: "main", head: { kind: "pull", number: 12 }, commits: 3, files: 5 },
    ],
    unchanged: [],
    code: false,
  }
  const change: OpenChange = { summary: pull, status: () => Promise.resolve(missing) }
  const pullRequest = () =>
    Promise.resolve({ title: "Add partial refunds", author: "alice", draft: false })
  const opening: Opening = {
    kind: "change",
    choice: { kind: "pull-request", url },
    change,
    status: missing,
  }
  const frame = await narrow(app(".", opening, sources({ pullRequest })), (_input, on) =>
    on.shows("#12 Add partial refunds"),
  )

  expect(frame).toContain("alice  ¦  3 commits  ¦  5 files")
})

test("a change that opens quickly comes up without an opening screen first", async () => {
  const opened = deferred<OpenChange>()
  const open = () => opened.promise
  const frame = await narrow(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    // the change is being worked out, and quickly, so far
    expect(await on.frame()).not.toContain("opening")
    opened.resolve(changeWith(() => Promise.resolve(missing)))
    await on.shows("no trek yet")
  })

  expect(frame).toContain("feature/refunds")
})

test("a pull request opens on its title, never on its number first", async () => {
  const url = "https://github.com/acme/web/pull/12"
  const pullRequests = () =>
    Promise.resolve([
      {
        number: 12,
        title: "Add partial refunds",
        author: "alice",
        url,
        draft: false,
        reviewRequested: true,
        mine: false,
        head: "a12",
        base: "main",
        updatedAt: "2026-11-23T10:00:00Z",
        commits: 3,
      },
    ])
  const pull: ChangeSummary = {
    changed: [
      { repo: "web", base: "main", head: { kind: "pull", number: 12 }, commits: 3, files: 5 },
    ],
    unchanged: [],
    code: false,
  }
  const open = () => Promise.resolve({ summary: pull, status: () => Promise.resolve(missing) })
  const details = deferred<PullRequestDetails>()
  const pullRequest = () => details.promise
  await narrow(
    app(".", LANDING, sources({ pullRequests, open, pullRequest })),
    async (input, on) => {
      await on.shows("#12 Add partial refunds")
      input.pressKey("j")
      await on.drawn()
      input.pressEnter()
      // opened, but gh hasn't said what the pull request is yet: the landing page stays
      expect(await on.frame()).toContain("your work")
      details.resolve({ title: "Add partial refunds", author: "alice", draft: false })
      await on.shows("alice  ¦  3 commits  ¦  5 files")
      expect(await on.frame()).toMatch(/ {2}#12 Add partial refunds\s+alice  ¦  3 commits/)
    },
  )
})

test("enter pressed again while a change opens opens it once", async () => {
  const opened = deferred<OpenChange>()
  const open = mock((_args: string[]) => opened.promise)
  await narrow(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    input.pressEnter()
    await on.drawn()
    opened.resolve(changeWith(() => Promise.resolve(missing)))
    await on.shows("no trek yet")
    // coming back, the change is worked out again, its screen having moved on
    expect(ownOpened(open)).toBe(1)
    input.pressEscape()
    await on.shows("your work")
  })
})

test("the change the selection rests on is worked out ahead, so enter opens it at once", async () => {
  const asked = deferred<undefined>()
  const open = mock((_args: string[]) => {
    asked.resolve(undefined)
    return Promise.resolve(changeWith(() => Promise.resolve(missing)))
  })
  await narrow(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    // nothing pressed yet: the branch selected is being worked out
    await asked.promise
    input.pressEnter()
    await on.drawn()
    expect(await on.frame()).toContain("no trek yet")
  })

  expect(ownOpened(open)).toBe(1)
})

test("building automatically starts a change's build as it's opened, never ahead of it", async () => {
  const asked = deferred<undefined>()
  let started = false
  const build = mock(() => {
    started = true
    return Promise.resolve()
  })
  const change: OpenChange = {
    summary,
    status: () => Promise.resolve(started ? building : missing),
    build,
  }
  const open = () => {
    asked.resolve(undefined)
    return Promise.resolve(change)
  }
  await narrow(
    app(".", LANDING, sources({ open }), { build_automatically: true }),
    async (input, on) => {
      await on.shows("your work")
      await asked.promise
      expect(build).not.toHaveBeenCalled()
      input.pressEnter()
      await on.shows("◐ building")
    },
  )

  expect(build).toHaveBeenCalledTimes(1)
})

test("a build started automatically that can't start leaves the change's screen as it stands", async () => {
  const change: OpenChange = {
    summary,
    status: () => Promise.resolve(missing),
    build: () => Promise.reject(new Error("EROFS: read-only file system")),
  }
  const frame = await narrow(
    app(".", LANDING, sources({ open: () => Promise.resolve(change) }), {
      build_automatically: true,
    }),
    async (input, on) => {
      await on.shows("your work")
      input.pressEnter()
      await on.shows("no trek yet")
    },
  )

  expect(frame).toContain("b: build")
})

test("a ready trek's screen comes up with its overview, not without it first", async () => {
  const root = await repoWithTrek()
  const open = () => Promise.resolve(changeWith(() => Promise.resolve(ready)))
  const overview = (name: string) => overviewOf(root, name)
  await narrow(
    app(root, LANDING, sources({ open, overview })),
    async (input, on) => {
      await on.shows("your work")
      input.pressEnter()
      await on.shows("● ready")
      expect(await on.frame()).toContain("3 stops")
    },
    30,
  )
})

test("back on the landing page, it's there at once as it was left, its change still selected", async () => {
  // read once, as the page first opens; never again, so it can't catch up by reading
  let loads = 0
  const load = () =>
    loads++ === 0 ? Promise.resolve(choices) : new Promise<BranchChoices>(() => undefined)
  const frame = await narrow(app(".", LANDING, sources({ load })), async (input, on) => {
    await on.shows("your work")
    input.pressKey("j")
    await on.shows(/▶ fix\/rounding/)
    input.pressEnter()
    await on.shows("no trek yet")
    await escape(input, on, "your work")
  })

  expect(frame).toMatch(/▶ fix\/rounding/)
})

// Wide enough for the split: the selected change's screen beside the list.
const WIDE = 130

const done = () => Promise.resolve()

// Whether the args name fix/rounding, as its range or on its own.
const roundingIn = (args: string[]) => args.some((arg) => arg.includes("fix/rounding"))

// The change the args open: fix/rounding's trek ready, the user's own branch's not built.
const openByArgs = (args: string[]) =>
  Promise.resolve(changeWith(() => Promise.resolve(roundingIn(args) ? ready : missing)))

test("wide, the selected change's screen is beside the list, its keys in the footer", async () => {
  const open = () => Promise.resolve({ ...changeWith(() => Promise.resolve(missing)), build: done })
  const frame = await frameAfter(
    app(".", LANDING, sources({ open })),
    (_input, on) => on.shows("no trek yet"),
    WIDE,
  )

  expect(frame).toMatch(/your work +│ +feature\/refunds/)
  expect(frame).toMatch(/▶ feature\/refunds +○ +│ +3 commits since main/)
  expect(frame).toContain("↵: build  ¦  a: add repos")
})

test("moving the selection shows the next change beside the list", async () => {
  const root = await repoWithTrek()
  const from = sources({ open: openByArgs, overview: (name) => overviewOf(root, name) })
  const frame = await frameAfter(
    app(root, LANDING, from),
    async (input, on) => {
      await on.shows("no trek yet")
      input.pressKey("j")
      await on.shows("3 stops")
    },
    WIDE,
    30,
  )

  expect(frame).toContain("↵: step here")
  expect(frame).not.toContain("no trek yet")
})

test("enter beside the list builds a change with no trek, the list staying", async () => {
  let started = false
  const build = mock(() => {
    started = true
    return Promise.resolve()
  })
  const change: OpenChange = {
    summary,
    status: () => Promise.resolve(started ? building : missing),
    build,
  }
  const frame = await frameAfter(
    app(".", LANDING, sources({ open: () => Promise.resolve(change) })),
    async (input, on) => {
      await on.shows("↵: build")
      input.pressEnter()
      await on.shows("◐ building")
    },
    WIDE,
  )

  expect(build).toHaveBeenCalledTimes(1)
  expect(frame).toContain("your work")
})

test("enter beside the list steps a ready trek, and q comes back to the list", async () => {
  const root = await repoWithTrek()
  const open = () => Promise.resolve(changeWith(() => Promise.resolve(ready)))
  const frame = await frameAfter(
    app(root, LANDING, sources({ open, overview: (name) => overviewOf(root, name) })),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressEnter()
      await on.shows("1 / 3")
      input.pressKey("q")
      await on.shows("your work")
    },
    WIDE,
    30,
  )

  expect(frame).toContain("3 stops")
})

test("while the next change is worked out, the last stays beside the list, then says it's opening", async () => {
  const later = deferred<OpenChange>()
  const open = (args: string[]) =>
    roundingIn(args) ? later.promise : Promise.resolve(changeWith(() => Promise.resolve(missing)))
  const frame = await frameAfter(
    app(".", LANDING, sources({ open })),
    async (input, on) => {
      await on.shows("no trek yet")
      input.pressKey("j")
      await on.shows("opening…")
    },
    WIDE,
  )

  expect(frame).not.toContain("no trek yet")
  expect(frame).not.toContain("↵")
})

test("beside the list, coming back to a change shows it at once, as it was kept", async () => {
  await frameAfter(
    app(".", LANDING, sources({ open: openByArgs })),
    async (input, on) => {
      await on.shows("no trek yet")
      input.pressKey("j")
      await on.shows("● ready")
      input.pressKey("k")
      await on.drawn()
      expect(await on.frame()).toContain("no trek yet")
    },
    WIDE,
  )
})

test("the changes listed are worked out ahead, so moving to one shows it at once", async () => {
  const roundingAsked = deferred<undefined>()
  const open = (args: string[]) => {
    if (roundingIn(args)) {
      roundingAsked.resolve(undefined)
    }

    return openByArgs(args)
  }
  await frameAfter(
    app(".", LANDING, sources({ open })),
    async (input, on) => {
      await on.shows("no trek yet")
      // nothing pressed: fix/rounding is worked out ahead of being selected
      await roundingAsked.promise
      await Bun.sleep(20)
      input.pressKey("j")
      await on.drawn()
      expect(await on.frame()).toContain("● ready")
    },
    WIDE,
  )
})

test("the worktree moving on, the changes listed are worked out again", async () => {
  let moved = false
  const open = mock(openByArgs)
  const stamp = () => Promise.resolve(moved ? "moved" : "before")
  await frameAfter(
    app(".", LANDING, sources({ open, stamp })),
    async (_input, on) => {
      await on.shows("no trek yet")
      while (open.mock.calls.filter(([args]) => roundingIn(args)).length < 1) {
        await Bun.sleep(10)
      }

      moved = true
      while (open.mock.calls.filter(([args]) => roundingIn(args)).length < 2) {
        await Bun.sleep(10)
      }
    },
    WIDE,
  )

  expect(open.mock.calls.filter(([args]) => roundingIn(args))).toHaveLength(2)
})

test("a kept change shown again is worked out again behind it, as files are edited meanwhile", async () => {
  // each time the user's own branch is worked out, one more file has changed
  let files = 0
  const open = (args: string[]) => {
    if (args.length > 0) {
      return openByArgs(args)
    }

    files += 1
    const changed = summary.changed.map((repo) => ({ ...repo, files }))
    return Promise.resolve({
      ...changeWith(() => Promise.resolve(missing)),
      summary: { ...summary, changed },
    })
  }
  const frame = await frameAfter(
    app(".", LANDING, sources({ open })),
    async (input, on) => {
      await on.shows("¦  1 file")
      input.pressKey("j")
      await on.shows("● ready")
      input.pressKey("k")
      await on.shows("¦  2 files")
    },
    WIDE,
  )

  expect(frame).toContain("no trek yet")
})

// The user's own pull request, its head where `head` says.
const ownPull = (head: string): OpenPullRequest => ({
  number: 7,
  title: "Retry refunds",
  author: "you",
  url: "https://github.com/acme/web/pull/7",
  draft: false,
  reviewRequested: false,
  mine: true,
  head,
  branch: "retry-refunds",
  base: "main",
  updatedAt: "2026-11-25T10:00:00Z",
  commits: 2,
})

const pullIn = (args: string[]) => args.some((arg) => arg.includes("/pull/7"))

// Opens the user's pull request and their branch, the worktree moving on once both are worked
// out; how often each was opened by then, once the branch is opened again.
async function openedAfterMoving(heads: readonly string[]) {
  let moved = false
  const open = mock(openByArgs)
  const opened = (which: (args: string[]) => boolean) =>
    open.mock.calls.filter(([args]) => which(args)).length
  const pullRequests = () => Promise.resolve([ownPull(heads[moved ? 1 : 0] ?? "")])
  const stamp = () => Promise.resolve(moved ? "moved" : "before")
  await frameAfter(
    app(".", LANDING, sources({ open, stamp, pullRequests })),
    async (_input, on) => {
      await on.shows("#7 Retry refunds")
      while (opened(pullIn) < 1 || opened((args) => args.length === 0) < 1) {
        await Bun.sleep(10)
      }

      moved = true
      while (opened((args) => args.length === 0) < 2) {
        await Bun.sleep(10)
      }

      // the list read again, and anything it starts, has had its turn
      await Bun.sleep(200)
    },
    WIDE,
  )

  return opened(pullIn)
}

test("the worktree moving on, a pull request whose head hasn't moved isn't fetched again", async () => {
  expect(await openedAfterMoving(["h1", "h1"])).toBe(1)
})

test("a pull request whose head has moved is worked out again", async () => {
  expect(await openedAfterMoving(["h1", "h2"])).toBe(2)
})

// The user's pull request #7, as its change sums it up.
const pullSummary: ChangeSummary = {
  ...summary,
  changed: summary.changed.map((repo) => ({ ...repo, head: { kind: "pull", number: 7 } })),
}

test("beside the list, a pull request's title comes from the list, as it's read again", async () => {
  let moved = false
  const pullRequest = mock(() => Promise.reject(new Error("not asked")))
  const pullRequests = () =>
    Promise.resolve([
      { ...ownPull("h1"), title: moved ? "Retry refunds, rounded" : "Retry refunds" },
    ])
  const stamp = () => Promise.resolve(moved ? "moved" : "before")
  const open = (args: string[]) =>
    pullIn(args)
      ? Promise.resolve({ ...changeWith(() => Promise.resolve(missing)), summary: pullSummary })
      : openByArgs(args)
  await frameAfter(
    app(".", LANDING, sources({ open, stamp, pullRequests, pullRequest })),
    async (input, on) => {
      await on.shows("#7 Retry refunds")
      input.pressKey("j")
      await on.shows(/│ +#7 Retry refunds +\n/)
      moved = true
      await on.shows(/│ +#7 Retry refunds, rounded +\n/)
    },
    WIDE,
  )

  expect(pullRequest).not.toHaveBeenCalled()
})
