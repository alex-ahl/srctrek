import { expect, test } from "bun:test"
import { App } from "../src/app"
import { renderFrame } from "../src/render-frame"
import type { TrekEntry } from "@srctrek/core"

const noop = () => undefined

test("renders the empty state", async () => {
  const frame = await renderFrame(<App entries={[]} onOpen={noop} onQuit={noop} />)
  expect(frame).toContain("No treks in .srctrek/treks")
})

test("lists valid and invalid treks", async () => {
  const entries: TrekEntry[] = [
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

const refund: TrekEntry = {
  name: "feature-refunds",
  path: "/t/feature-refunds.json",
  valid: true,
  title: "Refund orders",
  steps: 12,
  highFlags: 0,
}
const other: TrekEntry = { ...refund, name: "older", title: "An older trek" }

test("says a trek of the change is being built", async () => {
  const status = {
    kind: "building" as const,
    name: "feature-refunds",
    logTail: ['trek: started "Refund orders"', "trek: added s1, s2; the trek has s1, s2"],
  }
  const frame = await renderFrame(
    <App
      entries={[]}
      onOpen={noop}
      onQuit={noop}
      status={status}
      onBuild={noop}
      onShowLog={noop}
    />,
    100,
    12,
  )
  expect(frame).toContain("Building feature-refunds… your agent is on it")
  expect(frame).toContain("  trek: added s1, s2; the trek has s1, s2")
  expect(frame).toContain("· l log ·")
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

test("says how to have trek build treks when no agent is set", async () => {
  const status = { kind: "missing" as const, name: "feature-refunds" }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} />,
    120,
    8,
  )
  expect(frame).toContain("Set SRCTREK_AGENT to your agent's headless command")
  expect(frame).not.toContain("b build")
})

test("picks out the change's trek once it's ready", async () => {
  const status = { kind: "ready" as const, name: "feature-refunds" }
  const frame = await renderFrame(
    <App entries={[other, refund]} onOpen={noop} onQuit={noop} status={status} />,
    100,
    14,
  )
  expect(frame).toContain("This change's trek: feature-refunds")
  expect(frame).toContain("▶ Refund orders")
  expect(frame).not.toContain("▶ An older trek")
})

test("says there's nothing to trek when the change has no commits, and offers no build", async () => {
  const status = { kind: "empty" as const, name: "master" }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuild={noop} />,
    120,
    8,
  )
  expect(frame).toContain("This change has no commits, so there's nothing to trek.")
  expect(frame).not.toContain("b build")
})

test("shows as many treks as fit, each on its own two lines, and says which", async () => {
  const many = Array.from({ length: 24 }, (_, i) => ({
    ...refund,
    name: `t${i}`,
    title: `Trek ${i}`,
  }))
  const status = { kind: "empty" as const, name: "master" }
  const frame = await renderFrame(
    <App entries={many} onOpen={noop} onQuit={noop} status={status} />,
    120,
    24,
  )
  expect(frame).toContain("▶ Trek 0")
  expect(frame).toContain("    t0 · 12 steps")
  expect(frame).toContain("    t4 · 12 steps")
  expect(frame).toContain("1–5 of 24 · ↑/↓ choose")
  expect(frame).not.toContain("Trek 5")
})

test("lists the triggers found as rows to pick, each saying where its trek stands", async () => {
  const trigger = (name: string, line: number) => ({
    kind: "event" as const,
    name,
    evidence: { repo: "bot", file: "bot.py", line },
  })
  const status = {
    kind: "triggers" as const,
    name: "bot-code",
    triggers: [
      {
        trigger: trigger("a persona answers an @-mention", 311),
        trek: { kind: "missing" as const, name: "a-persona-answers-an-mention" },
      },
      {
        trigger: trigger("a reply times out", 91),
        trek: { kind: "ready" as const, name: "a-reply-times-out" },
      },
    ],
  }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuildTrigger={noop} />,
    120,
    16,
  )
  expect(frame).toContain("Found 2 ways into this code. Pick one to trek it.")
  expect(frame).toContain("▶ a persona answers an @-mention")
  expect(frame).toContain("    event · bot.py:311 · no trek yet")
  expect(frame).toContain("    event · bot.py:91 · trek ready")
  expect(frame).toContain("enter build its trek")
})

test("says a stale trek is out of date, how much changed, and offers to update it", async () => {
  const status = { kind: "stale" as const, name: "feature-refunds", staleSteps: 3, steps: 12 }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuild={noop} />,
    130,
    10,
  )

  expect(frame).toContain(
    "This change's trek feature-refunds is out of date: 3 of 12 steps cite files changed since it was built.  b: update it",
  )
  expect(frame).toContain("b update")
})

test("says a trek built with an older guide still opens, and offers to rebuild it", async () => {
  const status = { kind: "older-guide" as const, name: "feature-refunds" }
  const frame = await renderFrame(
    <App entries={[refund]} onOpen={noop} onQuit={noop} status={status} onBuild={noop} />,
    130,
    10,
  )

  expect(frame).toContain(
    "This change's trek feature-refunds was built with an older guide than today's.  b: rebuild it",
  )
  expect(frame).toContain("▶ Refund orders")
  expect(frame).toContain("enter open in Neovim · b rebuild")
})

test("says a trek that can't be read, with its problem, and offers to rebuild it", async () => {
  const status = {
    kind: "unreadable" as const,
    name: "feature-refunds",
    problem: "format_version: Invalid input: expected 1",
  }
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuild={noop} />,
    130,
    10,
  )

  expect(frame).toContain(
    "This change's trek feature-refunds can't be read: format_version: Invalid input: expected 1.  b: rebuild it",
  )
  expect(frame).toContain("b rebuild")
})
