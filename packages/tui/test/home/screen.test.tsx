import { expect, test } from "bun:test"
import type { ChangeSummary, TrekEntry, TrekState, TrekStatus } from "@srctrek/core"
import type { ComponentProps } from "react"
import { App } from "../../src/home/screen"
import { renderFrame } from "../../src/render-frame"
import { TERMINAL_TONES, bandFor, tonesFor } from "../../src/ui/theme"
import { frameAfter } from "../support/keys"

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
  repos: 1,
  code: false,
  heads: [{ repo: "web", head: { kind: "branch", name: "feature/refunds", uncommitted: false } }],
}
const other: TrekEntry = { ...refund, name: "older", title: "An older trek" }

test("renders the empty state", async () => {
  expect(await frameOf({})).toContain("No treks in .srctrek/treks yet.")
})

test("says what's open above its trek: each repo's head where they differ", async () => {
  const summary: ChangeSummary = {
    changed: [
      {
        repo: "web",
        base: "main",
        head: { kind: "branch", name: "feature/refunds", uncommitted: true },
        commits: 3,
      },
      {
        repo: "api",
        base: "main",
        head: { kind: "pull", number: 12 },
        commits: 1,
      },
    ],
    unchanged: ["worker"],
    code: false,
  }
  const frame = await frameOf({ summary })

  expect(frame).toContain(" srctrek › web › a change ")
  expect(frame).toContain(
    "feature/refunds + uncommitted · 3 commits since main · with api on pr 12 · worker passed through",
  )
})

test("leads with the branch and its commits since the base, then the repos passed through", async () => {
  const summary: ChangeSummary = {
    changed: [
      {
        repo: "web",
        base: "main",
        head: { kind: "branch", name: "feature/refunds", uncommitted: false },
        commits: 9,
      },
    ],
    unchanged: ["api", "worker"],
    code: false,
  }
  const frame = await frameOf({ summary })

  expect(frame).toContain("feature/refunds · 9 commits since main · api and worker passed through")
})

test("names the repo in the title bar, and only the change below for one repo", async () => {
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
  const frame = await frameOf({ summary })

  expect(frame).toContain(" srctrek › web › a change ")
  expect(frame).toMatch(/\n {2}feature\/refunds · 3 commits since main +\n/)
})

test("cuts what's open to a narrow terminal, the branch first", async () => {
  const summary: ChangeSummary = {
    changed: [
      {
        repo: "web",
        base: "main",
        head: { kind: "branch", name: "feature/a-long-branch-about-refunds", uncommitted: true },
        commits: 9,
      },
    ],
    unchanged: ["api", "worker"],
    code: false,
  }
  const frame = await frameOf({ summary }, 60)

  expect(frame).toContain("feature/a-long-branch-about-refunds + uncommitted · 9 c…")
})

test("says code as it is, in which repos, and from the trigger named", async () => {
  const summary: ChangeSummary = {
    changed: [],
    unchanged: ["web", "api"],
    code: true,
    trigger: "a refund request",
  }
  const frame = await frameOf({ summary })

  expect(frame).toContain(" srctrek › web › code as it is ")
  expect(frame).toContain('Code as it is in web · with api, from "a refund request"')
})

test("lists the treks in sections by what they're of, newest first, folding what can't be read", async () => {
  const entries: TrekEntry[] = [
    { ...other, code: true, heads: [], createdAt: new Date(2026, 9, 21).toISOString() },
    { ...refund, name: "refund", highFlags: 4 },
    {
      name: "broken",
      path: "/t/broken.json",
      valid: false,
      problem: "steps.1.via: missing evidence",
    },
  ]
  const frame = await frameOf({ entries })

  expect(frame).toContain(" OTHER BRANCHES AND PULL REQUESTS")
  expect(frame).toContain("▶ Refund orders   12 steps   ⚠ 4   built today 09:12")
  expect(frame).toContain(" CODE AS IT IS")
  expect(frame).toContain("   An older trek   12 steps         built Oct 21")
  expect(frame).toContain(" ▸ CAN'T READ  1 trek")
  expect(frame).not.toContain("broken")
})

test("puts treks of the change's branch with the change, and done treks folded away", async () => {
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
  const otherBranch = {
    ...other,
    name: "partial",
    heads: [
      { repo: "web", head: { kind: "branch" as const, name: "partial", uncommitted: false } },
    ],
  }
  const states = new Map<string, TrekState>([
    ["older", { kind: "stale", staleStops: 1, stops: 12 }],
    ["merged", { kind: "done", why: "merged" }],
  ])
  const entries = [refund, { ...other }, otherBranch, { ...other, name: "merged" }]
  const status: TrekStatus = { kind: "ready", name: "feature-refunds" }
  const frame = await frameOf({ entries, status, summary, states })

  expect(frame).toMatch(
    /THIS CHANGE *\n.*● ready   Refund orders .*\n.*≠ stale   An older trek   1 of 12 steps changed/,
  )
  expect(frame).toMatch(/OTHER BRANCHES AND PULL REQUESTS *\n *An older trek/)
  expect(frame).toContain(" ▸ DONE  1 trek")
  expect(frame).not.toContain("merged")
})

test("enter on a folded section shows its treks, and again hides them", async () => {
  const entries: TrekEntry[] = [
    {
      name: "broken",
      path: "/t/broken.json",
      valid: false,
      problem: "steps.1.via: missing evidence",
    },
  ]
  const app = <App entries={entries} onOpen={noop} onQuit={noop} now={NOW} />

  const opened = await frameAfter(app, (input) => input.pressEnter())
  expect(opened).toContain(" ▾ CAN'T READ  1 trek")
  expect(opened).toContain("broken")
  expect(opened).toContain("enter hide")

  const closed = await frameAfter(app, async (input) => {
    input.pressEnter()
    await new Promise((resolve) => setTimeout(resolve, 0))
    input.pressEnter()
  })
  expect(closed).toContain("enter show")
  expect(closed).not.toContain("broken")
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

  expect(frame).toMatch(/ ◐ building +\n/)
  expect(frame).toContain("   added s1, s2; the trek has s1, s2")
  expect(frame).toContain("l log")
  expect(frame).not.toContain("b build")
})

test("shows why a build failed, and offers to build again", async () => {
  const status: TrekStatus = { kind: "failed", name: "feature-refunds", logTail: ["no MCP server"] }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toMatch(/ ✕ build failed +\n/)
  expect(frame).toContain("   no MCP server")
  expect(frame).toContain("   b build again · l whole log")
  expect(frame).toContain("b build")
})

test("says what the agent does before a trek is built, and for code, that b finds its ways in", async () => {
  const missing: TrekStatus = { kind: "missing", name: "web-code" }
  const code: ChangeSummary = { changed: [], unchanged: ["web"], code: true }
  const change = await frameOf({ status: missing, onBuild: noop })
  const waysIn = await frameOf({ status: missing, onBuild: noop, summary: code })
  const trigger = await frameOf({
    status: missing,
    onBuild: noop,
    summary: { ...code, trigger: "a refund request" },
  })

  expect(change).toContain("   your agent walks the change from its trigger to its outcome")
  expect(waysIn).toMatch(/ ○ ways in not found yet +\n/)
  expect(waysIn).toContain("   b find them · then pick one, and b treks it")
  expect(trigger).toContain("   your agent follows it through the code, as it runs")
  expect(trigger).toContain("   b build it")
})

test("says it's finding the code's ways in while the agent does", async () => {
  const status: TrekStatus = { kind: "building", name: "web-code", logTail: [] }
  const summary: ChangeSummary = { changed: [], unchanged: ["web"], code: true }

  expect(await frameOf({ status, onBuild: noop, summary })).toMatch(/ ◐ finding its ways in +\n/)
})

test("points to settings when no agent is set", async () => {
  const frame = await frameOf({ status: { kind: "missing", name: "feature-refunds" } })

  expect(frame).toMatch(/ ○ no trek yet +\n/)
  expect(frame).toContain("   set an agent in settings, or ask your agent for a trek in chat")
  expect(frame).toContain("   S settings")
  expect(frame).not.toContain("b build")
})

test("picks out the change's trek once it's ready, with what it holds", async () => {
  const status: TrekStatus = { kind: "ready", name: "feature-refunds" }
  const frame = await frameOf({ entries: [other, { ...refund, highFlags: 1 }], status })

  expect(frame).toContain(" ● ready  Refund orders  12 steps · 1 repo   ⚠ 1 likely wrong")
  expect(frame).toContain("▶ ● ready   Refund orders   12 steps   ⚠ 1   built today 09:12")
  expect(frame).not.toContain("▶ An older trek")
})

test("says there's nothing to trek when the change has no commits, and offers no build", async () => {
  const frame = await frameOf({ status: { kind: "empty", name: "master" }, onBuild: noop })

  expect(frame).toContain(" ○ nothing to trek")
  expect(frame).toContain("   this change has no commits")
  expect(frame).toContain("   C choose another: a branch, a pull request, uncommitted work")
  expect(frame).not.toContain("b build")
})

test("leaves a trek saved earlier under the change's name as its own, once the change is empty", async () => {
  const status: TrekStatus = { kind: "empty", name: "feature-refunds" }
  const frame = await frameOf({ status, entries: [refund] })

  expect(frame).not.toContain("THIS CHANGE")
  expect(frame).not.toMatch(/nothing to trek +Refund orders/)
  expect(frame).toContain("Refund orders")
})

test("shows as many treks as fit, and says which", async () => {
  const many = Array.from({ length: 24 }, (_, i) => ({ ...refund, name: `t${i}` }))
  const frame = await frameOf({ entries: many }, 110, 12)

  expect(frame.match(/Refund orders/g)?.length).toBe(6)
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
  expect(frame).toContain("▶ ○ no trek yet   a persona answers an @-mention   event · bot.py:311")
  expect(frame).toContain("  ● ready         a reply times out                event · bot.py:91")
  expect(frame).toContain("enter build its trek")
})

test("says a stale trek is out of date, how much changed, and offers to update it", async () => {
  const status: TrekStatus = { kind: "stale", name: "feature-refunds", staleStops: 3, stops: 12 }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toContain(" ≠ stale  feature-refunds")
  expect(frame).toContain("   3 of 12 steps' files changed since it was built")
  expect(frame).toContain("   b update it")
  expect(frame).toContain("b update")
})

test("says a trek built with an older guide still opens, and offers to rebuild it", async () => {
  const status: TrekStatus = { kind: "older-guide", name: "feature-refunds" }
  const editor = { id: "nvim", label: "Neovim", command: "nvim", steps: true }
  const frame = await frameOf({ entries: [refund], status, onBuild: noop, editor })

  expect(frame).toContain(" ↻ older guide  Refund orders")
  expect(frame).toContain("   built before the guide last changed")
  expect(frame).toContain("   b rebuild with the current guide · enter open it")
  expect(frame).toContain("▶ ↻ older guide   Refund orders   12 steps   built today 09:12")
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

test("says a trek can't be opened, which repo, and how to fix it, with no key to press", async () => {
  const status: TrekStatus = {
    kind: "unreachable",
    name: "feature-refunds",
    unreachable: {
      repo: "worker",
      source: "../worker",
      revision: "c".repeat(40),
      reason: "missing",
    },
  }
  const frame = await frameOf({ entries: [refund], status, onBuild: noop })

  expect(frame).toContain(" ✕ can't open  feature-refunds")
  expect(frame).toContain("   repo worker isn't at ../worker")
  expect(frame).toContain("   clone it there to open this trek")
  expect(frame).toContain("▶ ✕ can't open   Refund orders   no worker at ../worker")
  expect(frame).not.toContain("b build")
  expect(frame).not.toContain("enter open")
})

test("tints the selected row instead of marking it, once the terminal's colours are known", async () => {
  const entries = [refund, other]
  const marked = await frameOf({ entries })
  const tinted = await frameOf({ entries, tint: bandFor("#16181b") })

  expect(marked).toContain("▶ Refund orders")
  expect(tinted).not.toContain("▶")
  expect(tinted).toContain("  Refund orders")
})

test("the band moves the terminal's background toward the accent, dark or light", () => {
  expect(bandFor("#16181b").toInts()).toEqual([32, 54, 52, 255])
  expect(bandFor("#ffffff").toInts()).toEqual([214, 231, 233, 255])
})

const dark = { foreground: "#d3d6da", background: "#16181b" }
const light = { foreground: "#24292f", background: "#ffffff" }

test("picks deep tones for a light terminal and bright ones for a dark one", () => {
  expect(tonesFor(dark).good.toInts()).toEqual([143, 207, 122, 255])
  expect(tonesFor(light).good.toInts()).toEqual([26, 127, 55, 255])
})

test("mixes secondary text from the terminal's own text and background, 60% of the way", () => {
  expect(tonesFor(dark).dim.toInts()).toEqual([135, 138, 142, 255])
  expect(tonesFor(light).dim.toInts()).toEqual([124, 127, 130, 255])
})

test("draws in the terminal's own ANSI colours until it says what it looks like", () => {
  expect(TERMINAL_TONES.good.intent).toBe("indexed")
  expect(TERMINAL_TONES.dim.intent).toBe("indexed")
  expect(tonesFor(dark).good.intent).toBe("rgb")
})
