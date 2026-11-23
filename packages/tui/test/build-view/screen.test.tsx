import { expect, test } from "bun:test"
import type { ChangeSummary } from "@srctrek/core"
import { BuildScreen } from "../../src/build-view/screen"
import type { BuildRead } from "../../src/build-view/read"
import { clockText, durationText } from "../../src/build-view/read"
import { frameAfter } from "../support/keys"

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

const started = new Date(2026, 10, 17, 9, 0, 0)

const building: BuildRead = {
  log: [
    "trek: opened web",
    "trek: read_file web src/refund.ts 1–end → 4238 chars",
    'trek: started "Refunding an order": add steps with add_steps',
    "trek: added s1, s2; the trek has s1, s2",
    "trek: nothing was added:",
    "trek: s3: cites web src/db.ts:88, which is blank",
  ],
  steps: [],
  count: 1,
  state: "building",
  started,
  ended: undefined,
}

function screen(read: BuildRead, onStop = () => undefined) {
  return (
    <BuildScreen
      summary={summary}
      name="feature-refunds"
      findsWaysIn={false}
      read={() => Promise.resolve(read)}
      onStop={onStop}
      onBuildAgain={() => undefined}
      onBack={() => undefined}
    />
  )
}

const settle = () => Bun.sleep(30)

test("shows the build as it stands: its title, steps, what was read, and a round rejected", async () => {
  const frame = await frameAfter(screen(building), settle, 100, 30)

  expect(frame).toContain("srctrek › build")
  expect(frame).toContain("feature/refunds · 3 commits since main")
  expect(frame).toContain("◐ building  Refunding an order")
  expect(frame).toMatch(/STEPS {2}2 steps added\s+s1 {2}s2/)
  expect(frame).toMatch(/READING {2}2 reads/)
  expect(frame).toMatch(/REJECTED {2}1 round\s+s3: cites web src\/db\.ts:88, which is blank/)
  expect(frame).toContain("x stop · tab the log · esc back")
})

test("says why a build ended without a trek, and offers to build again", async () => {
  const failed: BuildRead = {
    ...building,
    log: [...building.log, "Error: rate limit reached"],
    state: "failed",
    ended: new Date(started.getTime() + 72_000),
  }
  const frame = await frameAfter(screen(failed), settle, 100, 30)

  expect(frame).toContain("✕ build failed  Refunding an order  after 1m 12s")
  expect(frame).toMatch(/WHY\s+Error: rate limit reached/)
  expect(frame).toContain("b build again · tab the log")
  expect(frame).not.toContain("x stop")
})

test("says a build the user stopped is stopped, not failed, with no reason to give", async () => {
  const stopped: BuildRead = {
    ...building,
    log: [...building.log, "trek: stopped"],
    state: "failed",
    ended: new Date(started.getTime() + 72_000),
  }
  const frame = await frameAfter(screen(stopped), settle, 100, 30)

  expect(frame).toContain("■ stopped  Refunding an order  after 1m 12s")
  expect(frame).not.toContain("WHY")
  expect(frame).not.toContain("build failed")
})

test("lists each step's repo and summary once trek mcp keeps the draft, a hop and a flag marked", async () => {
  const withDraft: BuildRead = {
    ...building,
    steps: [
      { id: "s1", repo: "web", kind: "call", summary: "The refund button posts", flag: null },
      { id: "s2", repo: "api", kind: "hop", summary: "POST /refunds is handled", flag: "high" },
    ],
  }
  const frame = await frameAfter(screen(withDraft), settle, 100, 30)

  expect(frame).toMatch(/s1 +web +The refund button posts/)
  expect(frame).toMatch(/s2 +api +↯ POST \/refunds is handled +⚠ likely wrong/)
})

test("← steps to an older build, saying which, with nothing to stop or build there", async () => {
  const asked: number[] = []
  const older: BuildRead = { ...building, state: "failed", ended: started, count: 2 }
  const read = (back: number) => {
    asked.push(back)
    return Promise.resolve(back === 0 ? { ...building, count: 2 } : older)
  }
  const frame = await frameAfter(
    <BuildScreen
      summary={summary}
      name="feature-refunds"
      findsWaysIn={false}
      read={read}
      onStop={() => undefined}
      onBuildAgain={() => undefined}
      onBack={() => undefined}
    />,
    async (input) => {
      await settle()
      input.pressArrow("left")
      await settle()
    },
    100,
    30,
  )

  expect(asked).toContain(1)
  expect(frame).toMatch(/build 1 of 2 · started/)
  expect(frame).toContain("←/→ older, newer")
  expect(frame).not.toContain("x stop")
  expect(frame).not.toContain("b build again")
})

test("tab shows the log itself, following its end", async () => {
  const frame = await frameAfter(
    screen(building),
    async (input) => {
      await settle()
      input.pressTab()
      await settle()
    },
    100,
    30,
  )

  expect(frame).toContain("srctrek › build › log")
  expect(frame).toContain("trek: s3: cites web src/db.ts:88, which is blank")
})

test("x stops a build while it runs", async () => {
  let stopped = false
  await frameAfter(
    screen(building, () => {
      stopped = true
    }),
    async (input) => {
      await settle()
      input.pressKey("x")
      await settle()
    },
  )

  expect(stopped).toBe(true)
})

test("words how long a build ran, and how it ended", () => {
  expect(durationText(45_000)).toBe("45s")
  expect(durationText(220_000)).toBe("3m 40s")
  expect(durationText(3_720_000)).toBe("1h 02m")
  const ended = { ...building, ended: new Date(started.getTime() + 271_000) }
  expect(clockText(ended, new Date())).toBe("after 4m 31s")
})
