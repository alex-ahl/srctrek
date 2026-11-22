import { expect, mock, test } from "bun:test"
import { join } from "node:path"
import { useEffect, useState } from "react"
import type { ChangeSummary, ProposedRepo, TrekStatus } from "@srctrek/core"
import { repoWithTrek } from "@srctrek/testing"
import type { BuildRead } from "../../src/build-view/read"
import type { ChangeActions } from "../../src/change/keys"
import { type ChangeReads, ChangeScreen } from "../../src/change/screen"
import { frameAfter } from "../support/keys"

const summary: ChangeSummary = {
  changed: [
    {
      repo: "web",
      base: "main",
      head: { kind: "branch", name: "feature/refunds", uncommitted: false },
      commits: 9,
    },
  ],
  unchanged: [],
  code: false,
}

const noop = () => undefined
const done = () => Promise.resolve()

const ACTIONS: ChangeActions = {
  step: noop,
  editor: undefined,
  editorFirst: false,
  build: done,
  stop: done,
  builds: undefined,
  addRepo: done,
  dismissRepo: done,
  back: noop,
}

const NO_BUILD: BuildRead = {
  log: [],
  steps: [],
  state: undefined,
  started: undefined,
  ended: undefined,
  count: 0,
}

type Setup = Readonly<{
  actions?: Partial<ChangeActions>
  reads?: Partial<ChangeReads>
  proposals?: ProposedRepo[]
}>

function screen(root: string, status: TrekStatus, setup: Setup = {}) {
  const { actions = {}, reads = {}, proposals = [] } = setup
  return (
    <ChangeScreen
      root={root}
      summary={summary}
      status={status}
      proposals={proposals}
      reads={{
        status: () => Promise.resolve(status),
        build: () => Promise.resolve(NO_BUILD),
        proposals: () => Promise.resolve(proposals),
        ...reads,
      }}
      actions={{ ...ACTIONS, ...actions }}
    />
  )
}

const missing: TrekStatus = { kind: "missing", name: "feature-refunds" }
const ready: TrekStatus = { kind: "ready", name: "pay" }

test("leads with the change: its branch and how big it is", async () => {
  const frame = await frameAfter(screen(".", missing), (_input, on) => on.shows("no trek yet"))

  expect(frame).toContain("feature/refunds · 9 commits since main")
})

test("with no trek yet, says what b does, and b builds", async () => {
  const build = mock(done)
  const frame = await frameAfter(
    screen(".", missing, { actions: { build } }),
    async (input, on) => {
      await on.shows("no trek yet")
      input.pressKey("b")
    },
  )

  expect(frame).toContain("○ no trek yet")
  expect(frame).toContain("your agent walks your changes from their trigger to their outcome")
  expect(frame).toContain("b build · ? keys")
  expect(build).toHaveBeenCalled()
})

test("with no agent set, says how to get a trek, and offers no b", async () => {
  const frame = await frameAfter(
    screen(".", missing, { actions: { build: undefined } }),
    (_input, on) => on.shows("no trek yet"),
  )

  expect(frame).toContain("set an agent in settings")
  expect(frame).not.toContain("b build")
})

test("ready: the trek's overview, and enter steps it", async () => {
  const root = await repoWithTrek()
  const step = mock(noop)
  const frame = await frameAfter(
    screen(root, ready, { actions: { step, builds: noop } }),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressEnter()
    },
    110,
    30,
  )

  expect(frame).toContain("● ready")
  expect(frame).toContain("Pay")
  expect(frame).toContain("main pays through a helper.")
  expect(frame).toContain("⚠ 1 step likely wrong")
  expect(frame).toContain("enter step here · b build again · l builds · ? keys")
  expect(step).toHaveBeenCalled()
})

test("ready, with an editor: e opens it", async () => {
  const root = await repoWithTrek()
  const open = mock(noop)
  const frame = await frameAfter(
    screen(root, ready, { actions: { editor: { label: "step in Neovim", open } } }),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressKey("e")
    },
    110,
    30,
  )

  expect(frame).toContain("enter step here · e step in Neovim · b build again")
  expect(open).toHaveBeenCalled()
})

test("ready, with the editor chosen to step in: enter opens it, and n steps here", async () => {
  const root = await repoWithTrek()
  const open = mock(noop)
  const step = mock(noop)
  const frame = await frameAfter(
    screen(root, ready, {
      actions: { editor: { label: "step in Neovim", open }, editorFirst: true, step },
    }),
    async (input, on) => {
      await on.shows("3 stops")
      input.pressEnter()
      input.pressKey("n")
    },
    110,
    30,
  )

  expect(frame).toContain("enter step in Neovim · n step here")
  expect(open).toHaveBeenCalled()
  expect(step).toHaveBeenCalled()
})

test("stale: how many stops changed, the overview still, and b updates", async () => {
  const root = await repoWithTrek()
  const stale: TrekStatus = { kind: "stale", name: "pay", staleStops: 1, stops: 3 }
  const frame = await frameAfter(screen(root, stale), (_input, on) => on.shows("3 stops"), 110, 30)

  expect(frame).toContain("≠ stale")
  expect(frame).toContain("1 of 3 steps' files changed since it was built")
  expect(frame).toContain("enter step it as it is · b update")
})

test("a failed build: the end of its log, and b builds again", async () => {
  const failed: TrekStatus = {
    kind: "failed",
    name: "feature-refunds",
    logTail: ["trek: round 3 rejected, giving up"],
  }
  const frame = await frameAfter(screen(".", failed), (_input, on) => on.shows("build failed"))

  expect(frame).toContain("✕ build failed")
  expect(frame).toContain("round 3 rejected, giving up")
  expect(frame).toContain("b build again · ? keys")
  expect(frame).not.toContain("enter")
})

test("a branch with no commits: nothing to trek, and no b", async () => {
  const empty: TrekStatus = { kind: "empty", name: "feature-refunds" }
  const frame = await frameAfter(screen(".", empty), (_input, on) => on.shows("nothing to trek"))

  expect(frame).toContain("○ nothing to trek")
  expect(frame).not.toContain("b build")
})

test("esc goes back", async () => {
  const back = mock(noop)
  await frameAfter(screen(".", missing, { actions: { back } }), async (input, on) => {
    await on.shows("no trek yet")
    input.pressEscape()
    // escape reaches the screen only once the terminal's wait for a longer sequence is over
    while (back.mock.calls.length === 0) {
      await Bun.sleep(10)
    }
  })

  expect(back).toHaveBeenCalled()
})

const building: TrekStatus = { kind: "building", name: "feature-refunds", logTail: [] }

const BUILDING: BuildRead = {
  ...NO_BUILD,
  state: "building",
  started: new Date(),
  log: ["trek: opened ledger/post.ts"],
  steps: [
    { id: "s1", repo: "web", kind: "call", summary: "POST /refunds", flag: null },
    { id: "s2", repo: "web", kind: "call", summary: "createRefund", flag: null },
  ],
  count: 1,
}

test("b shows the build as soon as it starts", async () => {
  let started = false
  const build = mock(() => {
    started = true
    return Promise.resolve()
  })
  const frame = await frameAfter(
    screen(".", missing, {
      actions: { build },
      reads: { status: () => Promise.resolve(started ? building : missing) },
    }),
    async (input, on) => {
      await on.shows("no trek yet")
      input.pressKey("b")
      await on.shows("◐ building")
    },
  )

  expect(frame).not.toContain("no trek yet")
})

test("building: the steps as they arrive, and x stops it", async () => {
  const stop = mock(done)
  const frame = await frameAfter(
    screen(".", building, {
      actions: { stop },
      reads: { build: () => Promise.resolve(BUILDING) },
    }),
    async (input, on) => {
      await on.shows("createRefund")
      input.pressKey("x")
    },
  )

  expect(frame).toContain("2 steps so far")
  expect(frame).toContain("opened ledger/post.ts")
  expect(frame).toMatch(/s1 +web +POST \/refunds/)
  expect(frame).toContain("x stop · ? keys")
  expect(stop).toHaveBeenCalled()
})

test("a build that ends with a trek shows it ready, without a key", async () => {
  const root = await repoWithTrek()
  const name = { name: "pay" }
  const frame = await frameAfter(
    screen(
      root,
      { ...building, ...name },
      {
        reads: {
          status: () => Promise.resolve({ kind: "ready", ...name }),
        },
      },
    ),
    (_input, on) => on.shows("3 stops"),
    110,
    30,
  )

  expect(frame).toContain("● ready")
})

const billing: ProposedRepo = {
  name: "billing",
  source: "../billing",
  reason: "refunds post to the ledger in billing",
  evidence: [{ repo: "web", file: "ledger.ts", line: 3 }],
}

test("a repo the agent proposes: a adds it, and it leaves", async () => {
  const addRepo = mock((_name: string, _location?: string) => Promise.resolve())
  let added = false
  const frame = await frameAfter(
    screen(".", building, {
      actions: { addRepo: (name, location) => ((added = true), addRepo(name, location)) },
      reads: { proposals: () => Promise.resolve(added ? [] : [billing]) },
      proposals: [billing],
    }),
    async (input, on) => {
      await on.shows("the agent went into billing")
      input.pressKey("a")
      await on.shows(/^(?![\s\S]*went into billing)/)
    },
  )

  expect(addRepo).toHaveBeenCalledWith("billing", undefined)
  expect(frame).not.toContain("billing")
})

test("a proposed repo with no location: a asks where it lives", async () => {
  const addRepo = mock((_name: string, _location?: string) => Promise.resolve())
  const unknown = { ...billing, source: undefined }
  await frameAfter(
    screen(".", building, { actions: { addRepo }, proposals: [unknown] }),
    async (input, on) => {
      await on.shows("a add billing · x dismiss")
      input.pressKey("a")
      await on.shows("Where does billing live?")
      await input.typeText("../billing")
      input.pressEnter()
      await on.drawn()
    },
  )

  expect(addRepo).toHaveBeenCalledWith("billing", "../billing")
})

test("x dismisses a proposed repo before it stops the build", async () => {
  const dismissRepo = mock((_name: string) => Promise.resolve())
  const stop = mock(done)
  await frameAfter(
    screen(".", building, { actions: { dismissRepo, stop }, proposals: [billing] }),
    async (input, on) => {
      await on.shows("the agent went into billing")
      input.pressKey("x")
      await on.drawn()
    },
  )

  expect(dismissRepo).toHaveBeenCalledWith("billing")
  expect(stop).not.toHaveBeenCalled()
})

// Rewrites the trek saved as `name` with a new title, as an agent saving it again would.
async function retitle(root: string, name: string, title: string) {
  const path = join(root, ".srctrek", "treks", `${name}.json`)
  const saved = await Bun.file(path).text()
  await Bun.write(path, saved.replace(/"title": ?"[^"]*"/, `"title": "${title}"`))
}

test("a trek saved again under its name shows its new overview once the worktree moves on", async () => {
  const root = await repoWithTrek()
  function Moving() {
    const [generation, setGeneration] = useState(0)
    useEffect(() => {
      const timer = setTimeout(
        () => void retitle(root, "pay", "Pay again").then(() => setGeneration(1)),
        300,
      )
      return () => clearTimeout(timer)
    }, [])

    return (
      <ChangeScreen
        root={root}
        summary={summary}
        status={ready}
        proposals={[]}
        reads={{
          status: () => Promise.resolve(ready),
          build: () => Promise.resolve(NO_BUILD),
          proposals: () => Promise.resolve([]),
        }}
        actions={ACTIONS}
        generation={generation}
      />
    )
  }

  const frame = await frameAfter(<Moving />, (_input, on) => on.shows("Pay again"), 110, 30)

  expect(frame).toContain("Pay again")
})
