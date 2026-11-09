import { expect, test } from "bun:test"
import type { ChangeSummary, TrekEntry, TrekStatus } from "@srctrek/core"
import type { ComponentProps } from "react"
import { App } from "../src/app"
import { renderFrame } from "../src/render-frame"

const noop = () => undefined
const NOW = new Date(2026, 10, 9, 15, 0)

type AppProps = ComponentProps<typeof App>

// The home screen on a terminal `width` by `height`, with whatever `props` set.
function frameOf(props: Partial<AppProps>, width = 110, height = 20) {
  return renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} now={NOW} {...props} />,
    width,
    height,
  )
}

const refund: TrekEntry = {
  name: "feature-refunds",
  path: "/t/feature-refunds.json",
  valid: true,
  title: "Refund orders",
  steps: 12,
  highFlags: 0,
  createdAt: new Date(2026, 10, 9, 9, 12).toISOString(),
  code: false,
}
const other: TrekEntry = { ...refund, name: "older", title: "An older trek" }

test("renders the empty state", async () => {
  expect(await frameOf({})).toContain("No treks in .srctrek/treks yet.")
})

test("names the change and its size in the title bar", async () => {
  const summary: ChangeSummary = {
    changed: [
      {
        repo: "web",
        base: "main",
        head: { kind: "branch", name: "feature/refunds", uncommitted: true },
        commits: 3,
      },
      { repo: "api", base: "main", head: { kind: "pull", number: 12 }, commits: 1 },
    ],
    unchanged: ["worker"],
    code: false,
  }
  const frame = await frameOf({ summary })

  expect(frame).toContain(
    " srctrek  web · main...feature/refunds + uncommitted  api · pr 12  + worker",
  )
  expect(frame).toContain("3 repos · 4 commits")
})

test("lists the treks newest first, in columns sized to what they hold", async () => {
  const entries: TrekEntry[] = [
    { ...other, code: true, createdAt: new Date(2026, 9, 21).toISOString() },
    { ...refund, name: "refund", highFlags: 4 },
    {
      name: "broken",
      path: "/t/broken.json",
      valid: false,
      problem: "steps.1.via: missing evidence",
    },
  ]
  const frame = await frameOf({ entries })

  expect(frame).toContain(" TREKS")
  expect(frame.indexOf("refund")).toBeLessThan(frame.indexOf("older"))
  expect(frame).toContain("▶ refund               12 steps               ⚠ 4   today 09:12")
  expect(frame).toContain("  older                12 steps · code trek         Oct 21")
  expect(frame).toContain("  broken   ✕ invalid   steps.1.via: missing evidence")
})

test("leaves out when treks were built on a narrow terminal", async () => {
  const frame = await frameOf({ entries: [refund] }, 70)

  expect(frame).toContain("12 steps")
  expect(frame).not.toContain("today 09:12")
})

test("says a trek of the change is being built, with the end of its log", async () => {
  const status: TrekStatus = {
    kind: "building",
    name: "feature-refunds",
    logTail: ['trek: started "Refund orders"', "trek: added s1, s2; the trek has s1, s2"],
  }
  const frame = await frameOf({ status, onBuild: noop, onShowLog: noop })

  expect(frame).toContain(" ◐ building  feature-refunds")
  expect(frame).toContain("   added s1, s2; the trek has s1, s2")
  expect(frame).toContain("l log")
  expect(frame).not.toContain("b build")
})

test("shows why a build failed, and offers to build again", async () => {
  const status: TrekStatus = { kind: "failed", name: "feature-refunds", logTail: ["no MCP server"] }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toContain(" ✕ build failed  feature-refunds")
  expect(frame).toContain("   no MCP server")
  expect(frame).toContain("   b build again · l whole log")
  expect(frame).toContain("b build")
})

test("says how to have trek build treks when no agent is set", async () => {
  const frame = await frameOf({ status: { kind: "missing", name: "feature-refunds" } })

  expect(frame).toContain(" ○ no trek yet  feature-refunds")
  expect(frame).toContain("   set SRCTREK_AGENT to the command that runs your agent headless,")
  expect(frame).not.toContain("b build")
})

test("picks out the change's trek once it's ready, with what it holds", async () => {
  const status: TrekStatus = { kind: "ready", name: "feature-refunds" }
  const frame = await frameOf({ entries: [other, { ...refund, highFlags: 1 }], status })

  expect(frame).toContain(" ● ready  feature-refunds  12 steps · ⚠ 1 likely wrong")
  expect(frame).toContain("   Refund orders")
  expect(frame).toContain("▶ feature-refunds   ● ready   12 steps   ⚠ 1   today 09:12")
  expect(frame).not.toContain("▶ older")
})

test("says there's nothing to trek when the change has no commits, and offers no build", async () => {
  const frame = await frameOf({ status: { kind: "empty", name: "master" }, onBuild: noop })

  expect(frame).toContain(" ○ nothing to trek")
  expect(frame).toContain("   this change has no commits")
  expect(frame).not.toContain("b build")
})

test("shows as many treks as fit, and says which", async () => {
  const many = Array.from({ length: 24 }, (_, i) => ({ ...refund, name: `t${i}` }))
  const frame = await frameOf({ entries: many }, 110, 12)

  expect(frame).toContain("▶ t0 ")
  expect(frame).toContain("  t5 ")
  expect(frame).not.toContain("  t6 ")
  expect(frame).toContain("1–6 of 24")
})

test("lists the triggers found as rows to pick, each saying where its trek stands", async () => {
  const trigger = (name: string, line: number) => ({
    kind: "event" as const,
    name,
    evidence: { repo: "bot", file: "bot.py", line },
  })
  const status: TrekStatus = {
    kind: "triggers",
    name: "bot-code",
    triggers: [
      {
        trigger: trigger("a persona answers an @-mention", 311),
        trek: { kind: "missing", name: "a-persona-answers-an-mention" },
      },
      {
        trigger: trigger("a reply times out", 91),
        trek: { kind: "ready", name: "a-reply-times-out" },
      },
    ],
  }
  const frame = await frameOf({ status, onBuildTrigger: noop })

  expect(frame).toContain(" ◇ found 2 ways in")
  expect(frame).toContain(" WAYS INTO THIS CODE")
  expect(frame).toContain("▶ a persona answers an @-ment…   ○ no trek yet   event   bot.py:311")
  expect(frame).toContain("  a reply times out              ● ready         event   bot.py:91")
  expect(frame).toContain("enter build its trek")
})

test("says a stale trek is out of date, how much changed, and offers to update it", async () => {
  const status: TrekStatus = { kind: "stale", name: "feature-refunds", staleSteps: 3, steps: 12 }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toContain(" ● stale  feature-refunds")
  expect(frame).toContain("   3 of 12 steps' files changed since it was built")
  expect(frame).toContain("   b update it")
  expect(frame).toContain("b update")
})

test("says a trek built with an older guide still opens, and offers to rebuild it", async () => {
  const status: TrekStatus = { kind: "older-guide", name: "feature-refunds" }
  const frame = await frameOf({ entries: [refund], status, onBuild: noop })

  expect(frame).toContain(" ● older guide  feature-refunds")
  expect(frame).toContain("   built before the guide last changed")
  expect(frame).toContain("   b rebuild with the current guide · enter open it")
  expect(frame).toContain("▶ feature-refunds   ● older guide   12 steps   today 09:12")
  expect(frame).toContain("enter open in Neovim · b rebuild")
})

test("says a trek that can't be read, with its problem, and offers to rebuild it", async () => {
  const status: TrekStatus = {
    kind: "unreadable",
    name: "feature-refunds",
    problem: "format_version: Invalid input: expected 1",
  }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toContain(" ✕ can't read  feature-refunds")
  expect(frame).toContain("   format_version: Invalid input: expected 1")
  expect(frame).toContain("   b rebuild it")
  expect(frame).toContain("b rebuild")
})
