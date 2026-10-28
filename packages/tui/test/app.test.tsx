import { expect, test } from "bun:test"
import { App } from "../src/app"
import { renderFrame } from "../src/render-frame"
import type { TourEntry } from "../src/tour-list"

const noop = () => undefined

test("renders the empty state", async () => {
  const frame = await renderFrame(<App entries={[]} onOpen={noop} onQuit={noop} />)
  expect(frame).toContain("No tours in .codetrail/tours")
})

test("lists valid and invalid tours", async () => {
  const entries: TourEntry[] = [
    {
      name: "refund",
      path: "/t/refund.json",
      valid: true,
      title: "Refund orders",
      steps: 20,
      highFlags: 4,
    },
    {
      name: "broken",
      path: "/t/broken.json",
      valid: false,
      problem: "steps.1.via: missing evidence",
    },
  ]
  const frame = await renderFrame(<App entries={entries} onOpen={noop} onQuit={noop} />, 70, 14)
  expect(frame).toContain("▶ Refund orders")
  expect(frame).toContain("refund · 20 steps  ⚠ 4 high")
  expect(frame).toContain("broken · invalid: steps.1.via: missing evidence")
})

const refund: TourEntry = {
  name: "feature-refunds",
  path: "/t/feature-refunds.json",
  valid: true,
  title: "Refund orders",
  steps: 12,
  highFlags: 0,
}
const other: TourEntry = { ...refund, name: "older", title: "An older tour" }

test("says a tour of the change is being built", async () => {
  const status = { kind: "building" as const, name: "feature-refunds" }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuild={noop} />,
    100,
    8,
  )
  expect(frame).toContain("Building feature-refunds… your agent is on it")
  expect(frame).not.toContain("b build")
})

test("shows why a build failed, and offers to build again", async () => {
  const status = { kind: "failed" as const, name: "feature-refunds", logTail: ["no MCP server"] }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuild={noop} />,
    100,
    10,
  )
  expect(frame).toContain("Building feature-refunds failed. The end of its log:")
  expect(frame).toContain("  no MCP server")
  expect(frame).toContain("· b build ·")
})

test("says how to have trail build tours when no agent is set", async () => {
  const status = { kind: "missing" as const, name: "feature-refunds" }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} />,
    120,
    8,
  )
  expect(frame).toContain("Set CODETRAIL_AGENT to your agent's headless command")
  expect(frame).not.toContain("b build")
})

test("picks out the change's tour once it's ready", async () => {
  const status = { kind: "ready" as const, name: "feature-refunds" }
  const frame = await renderFrame(
    <App entries={[other, refund]} onOpen={noop} onQuit={noop} status={status} />,
    100,
    14,
  )
  expect(frame).toContain("This change's tour: feature-refunds")
  expect(frame).toContain("▶ Refund orders")
  expect(frame).not.toContain("▶ An older tour")
})

test("says there's nothing to tour when the change has no commits, and offers no build", async () => {
  const status = { kind: "empty" as const, name: "master" }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuild={noop} />,
    120,
    8,
  )
  expect(frame).toContain("This change has no commits, so there's nothing to tour.")
  expect(frame).not.toContain("b build")
})

test("shows as many tours as fit, each on its own two lines, and says which", async () => {
  const many = Array.from({ length: 24 }, (_, i) => ({
    ...refund,
    name: `t${i}`,
    title: `Tour ${i}`,
  }))
  const status = { kind: "empty" as const, name: "master" }
  const frame = await renderFrame(
    <App entries={many} onOpen={noop} onQuit={noop} status={status} />,
    120,
    24,
  )
  expect(frame).toContain("▶ Tour 0")
  expect(frame).toContain("    t0 · 12 steps")
  expect(frame).toContain("    t4 · 12 steps")
  expect(frame).toContain("1–5 of 24 · ↑/↓ choose")
  expect(frame).not.toContain("Tour 5")
})
