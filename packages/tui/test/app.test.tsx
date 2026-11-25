import { expect, mock, test } from "bun:test"
import type {
  BranchChoices,
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
  others: [{ name: "fix/rounding", commits: 1 }],
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

const LANDING: Opening = { kind: "landing" }
const own: ChangeChoice = { kind: "own", uncommitted: false }

function app(root: string, opening: Opening, from: Sources = sources(), settings: Settings = {}) {
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
  const frame = await frameAfter(app(".", LANDING), (_input, on) => on.shows("your work"))

  expect(frame).toContain("feature/refunds")
})

test("enter on a change opens its screen, and esc goes back to the landing page", async () => {
  const open = mock((_args: string[]) =>
    Promise.resolve(changeWith(() => Promise.resolve(missing))),
  )
  const frame = await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    await on.shows("no trek yet")
    await escape(input, on, "your work")
  })

  expect(open).toHaveBeenCalledWith([])
  expect(frame).toContain("your work")
})

test("a change asked for opens on its screen, and esc goes to the landing page", async () => {
  const change = changeWith(() => Promise.resolve(missing))
  const opening: Opening = { kind: "change", choice: own, change, status: missing }
  const frame = await frameAfter(app(".", opening), async (input, on) => {
    await on.shows("no trek yet")
    await escape(input, on, "your work")
  })

  expect(frame).toContain("pull requests")
})

test("enter steps a ready trek from its first stop, and q comes back to the change", async () => {
  const root = await repoWithTrek()
  const change = changeWith(() => Promise.resolve(ready))
  const opening: Opening = { kind: "change", choice: own, change, status: ready }
  const frame = await frameAfter(
    app(root, opening),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressEnter()
      await on.shows("1 / 3")
      input.pressKey("q")
      await on.shows("3 stops")
    },
    110,
    30,
  )

  expect(frame).toContain("● ready")
})

test("a done trek opens on a screen of its own", async () => {
  const root = await repoWithTrek()
  const done = () => Promise.resolve([{ name: "pay", title: "Pay", why: "merged" }])
  const frame = await frameAfter(
    app(root, LANDING, sources({ done })),
    async (input, on) => {
      await on.shows("d: 1 done trek")
      input.pressKey("d")
      await on.shows("merged")
      input.pressEnter()
      await on.shows("3 stops")
    },
    110,
    30,
  )

  expect(frame).toContain("main pays through a helper.")
})

test("S opens settings from the landing page, and esc comes back", async () => {
  const frame = await frameAfter(app(".", LANDING), async (input, on) => {
    await on.shows("your work")
    input.pressKey("S", { shift: true })
    await on.shows("srctrek › settings")
    await escape(input, on, "your work")
  })

  expect(frame).not.toContain("srctrek › settings")
})

test("a change that can't be opened says why on the landing page, which stays", async () => {
  const open = () => Promise.reject(new Error("no such branch"))
  const frame = await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
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
  await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
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
  const frame = await frameAfter(
    app(root, opening, sources({ open, stamp })),
    async (_input, on) => {
      await on.shows("no trek yet")
      saved = true
      await on.shows("3 stops")
    },
    110,
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
  const frame = await frameAfter(
    app(root, opening),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressEnter()
      await on.shows("1 / 3")
      input.pressKey("q")
      await on.shows("3 stops")
    },
    110,
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
  const frame = await frameAfter(app(".", opening), async (input, on) => {
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
  const frame = await frameAfter(app(root, opening), (_input, on) => on.shows("3 stops"), 110, 30)

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
  const frame = await frameAfter(
    app(".", opening, sources({ proposals, addRepo })),
    async (input, on) => {
      await on.shows("the agent went into billing")
      input.pressKey("a")
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
  const frame = await frameAfter(app(".", opening), async (input, on) => {
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
  const frame = await frameAfter(app(".", opening, sources({ pullRequest })), (_input, on) =>
    on.shows("#12 Add partial refunds"),
  )

  expect(frame).toContain("alice · 3 commits · 5 files")
})

test("a change that opens quickly comes up without an opening screen first", async () => {
  const opened = deferred<OpenChange>()
  const open = () => opened.promise
  const frame = await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
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
  await frameAfter(
    app(".", LANDING, sources({ pullRequests, open, pullRequest })),
    async (input, on) => {
      await on.shows("#12 Add partial refunds")
      input.pressKey("j")
      await on.drawn()
      input.pressEnter()
      // opened, but gh hasn't said what the pull request is yet: the landing page stays
      expect(await on.frame()).toContain("your work")
      details.resolve({ title: "Add partial refunds", author: "alice", draft: false })
      await on.shows("alice · 3 commits · 5 files")
      expect(await on.frame()).toMatch(/ {2}#12 Add partial refunds\s+alice · 3 commits/)
    },
  )
})

test("enter pressed again while a change opens opens it once", async () => {
  const opened = deferred<OpenChange>()
  const open = mock((_args: string[]) => opened.promise)
  await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    input.pressEnter()
    input.pressEnter()
    await on.drawn()
    opened.resolve(changeWith(() => Promise.resolve(missing)))
    await on.shows("no trek yet")
    input.pressEscape()
    await on.shows("your work")
  })

  expect(open).toHaveBeenCalledTimes(1)
})

test("the change the selection rests on is worked out ahead, so enter opens it at once", async () => {
  const asked = deferred<undefined>()
  const open = mock((_args: string[]) => {
    asked.resolve(undefined)
    return Promise.resolve(changeWith(() => Promise.resolve(missing)))
  })
  await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("your work")
    // nothing pressed yet: the branch selected is being worked out
    await asked.promise
    input.pressEnter()
    await on.drawn()
    expect(await on.frame()).toContain("no trek yet")
  })

  expect(open).toHaveBeenCalledTimes(1)
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
  await frameAfter(
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
  const frame = await frameAfter(
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
  await frameAfter(
    app(root, LANDING, sources({ open, overview })),
    async (input, on) => {
      await on.shows("your work")
      input.pressEnter()
      await on.shows("● ready")
      expect(await on.frame()).toContain("3 stops")
    },
    110,
    30,
  )
})

test("back on the landing page, it's there at once as it was left, its change still selected", async () => {
  // read once, as the page first opens; never again, so it can't catch up by reading
  let loads = 0
  const load = () =>
    loads++ === 0 ? Promise.resolve(choices) : new Promise<BranchChoices>(() => undefined)
  const frame = await frameAfter(app(".", LANDING, sources({ load })), async (input, on) => {
    await on.shows("your work")
    input.pressKey("j")
    await on.shows(/▶ fix\/rounding/)
    input.pressEnter()
    await on.shows("no trek yet")
    await escape(input, on, "your work")
  })

  expect(frame).toMatch(/▶ fix\/rounding/)
})
