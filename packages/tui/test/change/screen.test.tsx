import { expect, mock, test } from "bun:test"
import type { ChangeSummary, TrekStatus } from "@srctrek/core"
import { repoWithTrek } from "@srctrek/testing"
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
    },
  ],
  unchanged: [],
  code: false,
}

const noop = () => undefined

const ACTIONS: ChangeActions = {
  step: noop,
  editor: undefined,
  editorFirst: false,
  build: noop,
  builds: undefined,
  back: noop,
}

function screen(root: string, status: TrekStatus, actions: Partial<ChangeActions> = {}) {
  return (
    <ChangeScreen
      root={root}
      summary={summary}
      status={status}
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
  const build = mock(noop)
  const frame = await frameAfter(screen(".", missing, { build }), async (input, on) => {
    await on.shows("no trek yet")
    input.pressKey("b")
  })

  expect(frame).toContain("○ no trek yet")
  expect(frame).toContain("your agent walks your changes from their trigger to their outcome")
  expect(frame).toContain("b build · ? keys")
  expect(build).toHaveBeenCalled()
})

test("with no agent set, says how to get a trek, and offers no b", async () => {
  const frame = await frameAfter(screen(".", missing, { build: undefined }), (_input, on) =>
    on.shows("no trek yet"),
  )

  expect(frame).toContain("set an agent in settings")
  expect(frame).not.toContain("b build")
})

test("ready: the trek's overview, and enter steps it", async () => {
  const root = await repoWithTrek()
  const step = mock(noop)
  const frame = await frameAfter(
    screen(root, ready, { step, builds: noop }),
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
    screen(root, ready, { editor: { label: "step in Neovim", open } }),
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
    screen(root, ready, { editor: { label: "step in Neovim", open }, editorFirst: true, step }),
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
  await frameAfter(screen(".", missing, { back }), async (input, on) => {
    await on.shows("no trek yet")
    input.pressEscape()
    // escape reaches the screen only once the terminal's wait for a longer sequence is over
    while (back.mock.calls.length === 0) {
      await Bun.sleep(10)
    }
  })

  expect(back).toHaveBeenCalled()
})
