import { expect, mock, test } from "bun:test"
import { join } from "node:path"
import { useEffect, useState } from "react"
import type { ChangeSummary, ProposedRepo, TrekStatus } from "@srctrek/core"
import { repoWithTrek } from "@srctrek/testing"
import type { BuildRead } from "../../src/build-view/read"
import type { ChangeActions } from "../../src/change/keys"
import { ChangeScreen } from "../../src/change/screen"
import { frameAfter } from "../support/keys"

const summary: ChangeSummary = {
  changed: [
    {
      repo: "web",
      base: "main",
      head: { kind: "branch", name: "feature/refunds", uncommitted: false },
      commits: 9,
      files: 14,
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
  readBuild?: () => Promise<BuildRead>
  proposal?: ProposedRepo
}>

// Work a key starts runs here and is done with: reading where things stand again is the
// router's, and tested with it.
const run = (work: Promise<void>) => void work.catch(() => undefined)

function screen(root: string, status: TrekStatus, setup: Setup = {}) {
  return (
    <ChangeScreen
      root={root}
      summary={summary}
      status={status}
      proposal={setup.proposal}
      readBuild={setup.readBuild ?? (() => Promise.resolve(NO_BUILD))}
      actions={{ ...ACTIONS, ...setup.actions }}
      run={run}
      generation={0}
    />
  )
}

const missing: TrekStatus = { kind: "missing", name: "feature-refunds" }
const ready: TrekStatus = { kind: "ready", name: "pay" }

test("leads with the change: its branch, then how big it is", async () => {
  const frame = await frameAfter(screen(".", missing), (_input, on) => on.shows("no trek yet"))

  expect(frame).toMatch(/\n {2}feature\/refunds *\n {2}9 commits since main · 14 files *\n/)
})

test("a pull request leads with its number and title, then who opened it and how big it is", async () => {
  const pull: ChangeSummary = {
    changed: [
      { repo: "web", base: "main", head: { kind: "pull", number: 12 }, commits: 3, files: 5 },
    ],
    unchanged: [],
    code: false,
  }
  const frame = await frameAfter(
    <ChangeScreen
      root="."
      summary={pull}
      details={{ title: "Add partial refunds", author: "alice", draft: true }}
      status={missing}
      proposal={undefined}
      readBuild={() => Promise.resolve(NO_BUILD)}
      actions={ACTIONS}
      run={run}
      generation={0}
    />,
    (_input, on) => on.shows("no trek yet"),
  )

  expect(frame).toMatch(
    /\n {2}#12 Add partial refunds *\n {2}alice · draft · 3 commits · 5 files *\n/,
  )
})

test("a change across repos says how many files each changes", async () => {
  const across: ChangeSummary = {
    changed: [
      {
        repo: "web",
        base: "main",
        head: { kind: "branch", name: "feature/refunds", uncommitted: false },
        commits: 9,
        files: 6,
      },
      {
        repo: "api",
        base: "main",
        head: { kind: "branch", name: "refunds-api", uncommitted: false },
        commits: 2,
        files: 8,
      },
    ],
    unchanged: [],
    code: false,
  }
  const frame = await frameAfter(
    <ChangeScreen
      root="."
      summary={across}
      status={missing}
      proposal={undefined}
      readBuild={() => Promise.resolve(NO_BUILD)}
      actions={ACTIONS}
      run={run}
      generation={0}
    />,
    (_input, on) => on.shows("no trek yet"),
    120,
  )

  expect(frame).toContain("feature/refunds · with api on refunds-api")
  expect(frame).toContain("11 commits · 14 files · web 6, api 8")
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
  expect(frame).toContain("b builds one: your agent picks an example and follows it")
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

test("building: the steps as they arrive, and x stops it", async () => {
  const stop = mock(done)
  const frame = await frameAfter(
    screen(".", building, { actions: { stop }, readBuild: () => Promise.resolve(BUILDING) }),
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

const billing: ProposedRepo = {
  name: "billing",
  source: "../billing",
  reason: "refunds post to the ledger in billing",
  evidence: [{ repo: "web", file: "ledger.ts", line: 3 }],
}

test("a repo the agent proposes: a adds it where the agent found it", async () => {
  const addRepo = mock((_name: string, _location?: string) => Promise.resolve())
  await frameAfter(
    screen(".", building, { actions: { addRepo }, proposal: billing }),
    async (input, on) => {
      await on.shows("the agent went into billing")
      input.pressKey("a")
      await on.drawn()
    },
  )

  expect(addRepo).toHaveBeenCalledWith("billing")
})

test("a proposed repo with no location: a asks where it lives", async () => {
  const addRepo = mock((_name: string, _location?: string) => Promise.resolve())
  const unknown = { ...billing, source: undefined }
  await frameAfter(
    screen(".", building, { actions: { addRepo }, proposal: unknown }),
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
    screen(".", building, { actions: { dismissRepo, stop }, proposal: billing }),
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
        proposal={undefined}
        readBuild={() => Promise.resolve(NO_BUILD)}
        actions={ACTIONS}
        run={run}
        generation={generation}
      />
    )
  }

  const frame = await frameAfter(<Moving />, (_input, on) => on.shows("Pay again"), 110, 30)

  expect(frame).toContain("Pay again")
})

test("with no trek yet, offers no builds to look at", async () => {
  const frame = await frameAfter(screen(".", missing, { actions: { builds: noop } }), (_i, on) =>
    on.shows("no trek yet"),
  )

  expect(frame).toContain("b build · ? keys")
  expect(frame).not.toContain("l builds")
})

test("a trek whose work is done says how it ended, the trek first", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    <ChangeScreen
      root={root}
      summary={undefined}
      status={ready}
      done="merged"
      proposal={undefined}
      readBuild={() => Promise.resolve(NO_BUILD)}
      actions={{ ...ACTIONS, build: undefined }}
      run={run}
      generation={0}
    />,
    (_input, on) => on.shows("3 stops"),
    110,
    30,
  )

  expect(frame).toMatch(/─\n\s*\n  ✓ merged/)
  expect(frame).not.toContain("● ready")
})
