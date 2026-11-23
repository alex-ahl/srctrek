import { expect, mock, test } from "bun:test"
import type { BranchChoices, ChangeChoice, ChangeSummary, TrekStatus } from "@srctrek/core"
import { repoWithTrek } from "@srctrek/testing"
import { App, type Opening } from "../src/app"
import type { OpenChange } from "../src/change/open-change"
import type { Sources } from "../src/sources"
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
    nearby: () => Promise.resolve([]),
    repoBranches: () => Promise.reject(new Error("no branches here")),
    fetchRepo: () => Promise.resolve(),
    status: () => Promise.resolve(missing),
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

function app(root: string, opening: Opening, from: Sources = sources()) {
  return (
    <App
      root={root}
      opening={opening}
      sources={from}
      firstSettings={{}}
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
  const frame = await frameAfter(app(".", LANDING), (_input, on) => on.shows("YOUR WORK"))

  expect(frame).toContain("feature/refunds")
})

test("enter on a change opens its screen, and esc goes back to the landing page", async () => {
  const open = mock((_args: string[]) =>
    Promise.resolve(changeWith(() => Promise.resolve(missing))),
  )
  const frame = await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("YOUR WORK")
    input.pressEnter()
    await on.shows("no trek yet")
    await escape(input, on, "YOUR WORK")
  })

  expect(open).toHaveBeenCalledWith([])
  expect(frame).toContain("YOUR WORK")
})

test("a change asked for opens on its screen, and esc goes to the landing page", async () => {
  const change = changeWith(() => Promise.resolve(missing))
  const opening: Opening = { kind: "change", choice: own, change, status: missing }
  const frame = await frameAfter(app(".", opening), async (input, on) => {
    await on.shows("no trek yet")
    await escape(input, on, "YOUR WORK")
  })

  expect(frame).toContain("WAITING ON YOUR REVIEW")
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
      await on.shows("▸ DONE  1")
      for (const _ of [1, 2, 3, 4]) {
        input.pressKey("j")
        await on.drawn()
      }
      input.pressEnter()
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
    await on.shows("YOUR WORK")
    input.pressKey("S", { shift: true })
    await on.shows("srctrek › settings")
    await escape(input, on, "YOUR WORK")
  })

  expect(frame).not.toContain("srctrek › settings")
})

test("a change that can't be opened says why, and esc goes back", async () => {
  const open = () => Promise.reject(new Error("no such branch"))
  const frame = await frameAfter(app(".", LANDING, sources({ open })), async (input, on) => {
    await on.shows("YOUR WORK")
    input.pressEnter()
    await on.shows("no such branch")
  })

  expect(frame).toContain("✕ couldn't open your branch: no such branch")
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
    await escape(input, on, "YOUR WORK")
  })

  expect(frame).toContain("CODE AS IT IS")
})
