import { expect, mock, test } from "bun:test"
import type { ChangeSummary, Trigger, TrekStatus } from "@srctrek/core"
import type { BuildRead } from "../../src/build-view/read"
import type { ChangeActions } from "../../src/change/keys"
import { ChangeScreen } from "../../src/change/screen"
import { WaysInScreen } from "../../src/change/ways-in-screen"
import type { WaysInActions } from "../../src/change/ways-in"
import { frameAfter } from "../support/keys"

const code: ChangeSummary = { changed: [], unchanged: ["web"], code: true }

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

const WAYS: WaysInActions = { stepTrek: noop, buildTrigger: done, follow: noop }

const NO_BUILD: BuildRead = {
  log: [],
  steps: [],
  state: undefined,
  started: undefined,
  ended: undefined,
  count: 0,
}

const trigger = (name: string, file: string, line: number): Trigger => ({
  kind: "request",
  name,
  evidence: { repo: "web", file, line },
})

const found: TrekStatus = {
  kind: "triggers",
  name: "web",
  triggers: [
    {
      trigger: trigger("POST /refunds", "routes/refunds.ts", 12),
      trek: { kind: "ready", name: "web-post-refunds" },
    },
    {
      trigger: trigger("nightly reconcile", "jobs/reconcile.ts", 4),
      trek: { kind: "missing", name: "web-nightly-reconcile" },
    },
  ],
}

// Work a key starts runs here and is done with: reading where things stand again is the router's.
const run = (work: Promise<void>) => void work.catch(() => undefined)

function screen(
  status: TrekStatus,
  setup: { actions?: Partial<ChangeActions>; ways?: Partial<WaysInActions> } = {},
) {
  const actions = { ...ACTIONS, ...setup.actions }
  if (status.kind !== "triggers") {
    return (
      <ChangeScreen
        root="."
        summary={code}
        status={status}
        proposal={undefined}
        readBuild={() => Promise.resolve(NO_BUILD)}
        actions={actions}
        run={run}
        generation={0}
      />
    )
  }

  return (
    <WaysInScreen
      summary={code}
      ways={status.triggers}
      actions={{ ...WAYS, ...setup.ways }}
      find={actions.build}
      run={run}
      back={actions.back}
    />
  )
}

test("lists the code's ways in, each with its trek's state and where it's found", async () => {
  const frame = await frameAfter(screen(found), (_input, on) => on.shows("POST /refunds"))

  expect(frame).toMatch(/● +POST \/refunds +routes\/refunds\.ts:12/)
  expect(frame).toMatch(/○ +nightly reconcile +jobs\/reconcile\.ts:4/)
  expect(frame).toContain("follow a trigger…")
  expect(frame).toContain("↵ step its trek   b build again   B find ways in again   ? keys")
})

test("enter on a way in with a trek steps it", async () => {
  const stepTrek = mock((_name: string) => undefined)
  await frameAfter(screen(found, { ways: { stepTrek } }), async (input, on) => {
    await on.shows("POST /refunds")
    input.pressEnter()
  })

  expect(stepTrek).toHaveBeenCalledWith("web-post-refunds")
})

test("b on a way in with no trek builds it", async () => {
  const buildTrigger = mock((_trigger: string) => Promise.resolve())
  const frame = await frameAfter(screen(found, { ways: { buildTrigger } }), async (input, on) => {
    await on.shows("POST /refunds")
    input.pressArrow("down")
    await on.shows("b build   B")
    input.pressKey("b")
  })

  expect(frame).not.toContain("enter step its trek")
  expect(buildTrigger).toHaveBeenCalledWith("nightly reconcile")
})

test("B finds the ways in again", async () => {
  const build = mock(done)
  await frameAfter(screen(found, { actions: { build } }), async (input, on) => {
    await on.shows("POST /refunds")
    input.pressKey("B", { shift: true })
  })

  expect(build).toHaveBeenCalled()
})

test("follow a trigger…: asks for one in the user's words, and follows it", async () => {
  const follow = mock((_trigger: string) => undefined)
  await frameAfter(screen(found, { ways: { follow } }), async (input, on) => {
    await on.shows("POST /refunds")
    input.pressArrow("down")
    await on.drawn()
    input.pressArrow("down")
    await on.shows("↵ follow one")
    input.pressEnter()
    await on.shows("Follow:")
    await input.typeText("a refund request")
    input.pressEnter()
    await on.drawn()
  })

  expect(follow).toHaveBeenCalledWith("a refund request")
})

test("before its ways in are found: says so, and b finds them", async () => {
  const build = mock(done)
  const missing: TrekStatus = { kind: "missing", name: "web" }
  const frame = await frameAfter(screen(missing, { actions: { build } }), async (input, on) => {
    await on.shows("ways in not found yet")
    input.pressKey("b")
  })

  expect(frame).toContain("b find ways in   ? keys")
  expect(build).toHaveBeenCalled()
})
