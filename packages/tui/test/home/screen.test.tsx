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

test("says what's open in the title bar: each repo's head where they differ", async () => {
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
  const frame = await frameOf({ summary }, 160)

  expect(frame).toContain(" srctrek › web ")
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

test("names the repo and the change in the title bar", async () => {
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

  expect(frame).toMatch(/srctrek › web +feature\/refunds · 3 commits since main/)
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

  expect(frame).toContain("srctrek › web  feature/a-long-branch-about-refunds + un…")
})

test("says code as it is, in which repos, and from the trigger named", async () => {
  const summary: ChangeSummary = {
    changed: [],
    unchanged: ["web", "api"],
    code: true,
    trigger: "a refund request",
  }
  const frame = await frameOf({ summary })

  expect(frame).toContain(" srctrek › web ")
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

  expect(frame).toContain(" CODE AS IT IS")
  expect(frame).toMatch(/▶ An older trek +12 steps/)
  expect(frame).toContain(" OTHER BRANCHES AND PULL REQUESTS")
  expect(frame).toMatch(/ {3}Refund orders +12 steps +⚠ 4/)
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
    /YOUR CHANGES[^\n]*\n[^\n]*● ready +Refund orders[^\n]*\n[^\n]*≠ stale +An older trek +1 of 12 steps changed/,
  )
  expect(frame).toMatch(/OTHER BRANCHES AND PULL REQUESTS[^\n]*\n +An older trek/)
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

test("says a trek of the change is being built, leaving its detail to the build view", async () => {
  const status: TrekStatus = {
    kind: "building",
    name: "feature-refunds",
    logTail: ['trek: started "Refund orders"', "trek: added s1, s2; the trek has s1, s2"],
  }
  const frame = await frameOf({
    status,
    onBuild: noop,
    onReadBuild: () => Promise.reject(new Error("unread")),
  })

  expect(frame).toMatch(/│ ◐ building/)
  expect(frame).not.toContain("added s1, s2")
  expect(frame).toContain("l builds")
  expect(frame).not.toContain("b build")
})

test("shows why a build failed, and offers to build again", async () => {
  const status: TrekStatus = { kind: "failed", name: "feature-refunds", logTail: ["no MCP server"] }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toMatch(/│ ✕ build failed/)
  expect(frame).toMatch(/│ no MCP server/)
  expect(frame).toContain("b build · ? keys")
})

test("says what the agent does before a trek is built, and for code, that b finds its ways in", async () => {
  const change = await frameOf({
    status: { kind: "missing", name: "feature-refunds" },
    onBuild: noop,
  })
  const waysIn = await frameOf({
    codeStatus: { kind: "missing", name: "web-code" },
    onFindWaysIn: noop,
  })
  const trigger = await frameOf({
    asked: { name: "a refund request", trek: { kind: "missing", name: "a-refund-request" } },
    onBuildTrigger: noop,
  })

  expect(change).toMatch(/│ your agent walks the change from/)
  expect(waysIn).toMatch(/│ ○ ways in not found yet/)
  expect(waysIn).toContain("b find ways in")
  expect(trigger).toMatch(/│ your agent follows it through the/)
  expect(trigger).toContain("b build")
})

test("says it's finding the code's ways in while the agent does", async () => {
  const codeStatus: TrekStatus = { kind: "building", name: "web-code", logTail: [] }

  expect(await frameOf({ codeStatus, onFindWaysIn: noop })).toMatch(/│ ◐ finding its ways in/)
})

test("says a build the user stopped is stopped, and offers to build again", async () => {
  const status: TrekStatus = { kind: "failed", name: "feature-refunds", logTail: ["trek: stopped"] }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toMatch(/│ ■ stopped/)
  expect(frame).toContain("b build · ? keys")
  expect(frame).not.toContain("build failed")
})

test("points to settings when no agent is set", async () => {
  const frame = await frameOf({ status: { kind: "missing", name: "feature-refunds" } })

  expect(frame).toMatch(/│ ○ no trek yet/)
  expect(frame).toMatch(/│ set an agent in settings, or ask/)
  expect(frame).not.toContain("b build")
})

test("picks out the change's trek once it's ready, with what it holds", async () => {
  const status: TrekStatus = { kind: "ready", name: "feature-refunds" }
  const frame = await frameOf({ entries: [other, { ...refund, highFlags: 1 }], status })

  expect(frame).toMatch(/│ ● ready/)
  expect(frame).toMatch(/│ 12 steps · 1 repo/)
  expect(frame).toMatch(/│ ⚠ 1 likely wrong/)
  expect(frame).toMatch(/▶ ● ready   Refund orders   12 steps   ⚠ 1/)
  expect(frame).not.toContain("▶ An older trek")
})

test("says there's nothing to trek when the change has no commits, and offers no build", async () => {
  const frame = await frameOf({ status: { kind: "empty", name: "master" }, onBuild: noop })

  expect(frame).toMatch(/│ ○ nothing to trek/)
  expect(frame).toMatch(/│ no commits since its base: C picks/)
  expect(frame).not.toContain("b build")
})

test("leaves a trek saved earlier under the change's name as its own, once the change is empty", async () => {
  const status: TrekStatus = { kind: "empty", name: "feature-refunds" }
  const frame = await frameOf({ status, entries: [refund] })

  expect(frame).not.toContain("YOUR CHANGES")
  expect(frame).not.toMatch(/nothing to trek +Refund orders/)
  expect(frame).toContain("Refund orders")
})

test("shows as many treks as fit, and says which", async () => {
  const many = Array.from({ length: 24 }, (_, i) => ({ ...refund, name: `t${i}` }))
  const frame = await frameOf({ entries: many }, 110, 12)

  expect(frame.match(/Refund orders +12 steps/g)?.length).toBe(6)
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
  const frame = await frameOf({ codeStatus: status, onBuildTrigger: noop })

  expect(frame).toContain(" CODE AS IT IS")
  expect(frame).toMatch(/▶ ○ no trek yet +a persona answers an @-mention +event · bot\.py:/)
  expect(frame).toMatch(/ {2}● ready +a reply times out +event · bot\.py:/)
  expect(frame).toContain("enter build its trek")
})

test("shows the code as it is beside the change, its ways in found with b before they are", async () => {
  const found: string[] = []
  const app = (
    <App
      entries={[]}
      onOpen={noop}
      onQuit={noop}
      now={NOW}
      codeStatus={{ kind: "missing", name: "bot-code" }}
      onFindWaysIn={() => found.push("found")}
    />
  )
  const frame = await frameAfter(app, (input) => input.pressKey("b"))

  expect(frame).toContain(" CODE AS IT IS")
  expect(frame).toMatch(/◇ not found yet +ways into this code +b finds them/)
  expect(frame).toMatch(/│ your agent finds the routes,/)
  expect(frame).toContain("enter find ways in · b find ways in · ? keys")
  expect(found).toEqual(["found"])
})

test("heads the list with the selected row: a way in with no trek says b builds it, and builds it", async () => {
  const status: TrekStatus = {
    kind: "triggers",
    name: "bot-code",
    triggers: [
      {
        trigger: {
          kind: "event",
          name: "a reply times out",
          evidence: { repo: "bot", file: "bot.py", line: 91 },
        },
        trek: { kind: "missing", name: "a-reply-times-out" },
      },
    ],
  }
  const summary: ChangeSummary = { changed: [], unchanged: ["bot"], code: false }
  const built: string[] = []
  const app = (
    <App
      entries={[]}
      onOpen={noop}
      onQuit={noop}
      now={NOW}
      summary={summary}
      codeStatus={status}
      onBuildTrigger={(name) => built.push(name)}
    />
  )
  const frame = await frameAfter(app, (input) => input.pressKey("b"))

  expect(frame).toMatch(/│ a way into the code as it is/)
  expect(frame).toMatch(/│ in bot/)
  expect(frame).toMatch(/○ no trek yet +a reply times out/)
  expect(frame).toMatch(/│ your agent follows it through the/)
  expect(built).toEqual(["a reply times out"])
})

test("opens on the code as it is when trek's args asked for it", async () => {
  const status: TrekStatus = { kind: "ready", name: "feature-refunds" }
  const frame = await frameOf({
    entries: [refund],
    status,
    codeStatus: { kind: "missing", name: "web-code" },
    onFindWaysIn: noop,
    focus: { kind: "code" },
  })

  expect(frame).toMatch(/▶ ◇ not found yet +ways into this code/)
})

test("opens on the way in asked for by name, built with b when it has no trek", async () => {
  const built: string[] = []
  const app = (
    <App
      entries={[]}
      onOpen={noop}
      onQuit={noop}
      now={NOW}
      codeStatus={{ kind: "missing", name: "web-code" }}
      asked={{ name: "a refund request", trek: { kind: "missing", name: "a-refund-request" } }}
      focus={{ kind: "code", trigger: "a refund request" }}
      onFindWaysIn={noop}
      onBuildTrigger={(name) => built.push(name)}
    />
  )
  const frame = await frameAfter(app, (input) => input.pressKey("b"))

  expect(frame).toMatch(/▶ ○ no trek yet +a refund request +asked for/)
  expect(built).toEqual(["a refund request"])
})

test("lists your changes on a row of their own until their trek is saved, built with b, C picks others", async () => {
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
  const never = () => new Promise<never>(() => undefined)
  const choosing = {
    choice: { kind: "own" as const, uncommitted: false },
    load: never,
    pullRequests: never,
    nearby: never,
    repoBranches: never,
    fetchRepo: never,
    status: never,
    onPick: noop,
  }
  const built: string[] = []
  const app = (
    <App
      entries={[]}
      onOpen={noop}
      onQuit={noop}
      now={NOW}
      summary={summary}
      status={{ kind: "missing", name: "feature-refunds" }}
      onBuild={() => built.push("built")}
      choosing={choosing}
    />
  )
  const frame = await frameAfter(app, (input) => input.pressKey("b"))

  expect(frame).toMatch(
    /YOUR CHANGES[^\n]*\n *▶ ○ no trek yet +feature\/refunds · 3 commits since main +b build/,
  )
  expect(frame).toContain("enter build its trek · b build · C another change · ? keys")
  expect(built).toEqual(["built"])
})

test("describes the selected row in a pane beside the list, which stays where it is", async () => {
  const status: TrekStatus = { kind: "ready", name: "feature-refunds" }
  const props = {
    entries: [refund],
    status,
    codeStatus: { kind: "missing", name: "web-code" } as const,
    onFindWaysIn: noop,
  }
  const app = <App onOpen={noop} onQuit={noop} now={NOW} {...props} />
  const onChange = await frameAfter(app, () => undefined)
  const onWaysIn = await frameAfter(app, (input) => input.pressArrow("down"))
  const line = (frame: string, text: string) => frame.split("\n").findIndex((l) => l.includes(text))

  expect(onChange).toMatch(/│ your changes/)
  expect(onWaysIn).toMatch(/│ the code's ways in/)
  expect(line(onWaysIn, "YOUR CHANGES")).toBe(line(onChange, "YOUR CHANGES"))
  expect(line(onWaysIn, "ways into this code")).toBe(line(onChange, "ways into this code"))
})

test("describes the selected row on one line over the footer where there's no room for the pane", async () => {
  const status: TrekStatus = { kind: "ready", name: "feature-refunds" }
  const frame = await frameOf({ entries: [refund], status }, 80)

  expect(frame).not.toContain("│")
  expect(frame).toContain("your changes · ● ready · Refund orders")
})

test("lists a way in's trek once, on its way in's row", async () => {
  const wayIn: TrekEntry = {
    ...refund,
    name: "a-reply-times-out",
    title: "A reply times out",
    code: true,
    heads: [],
  }
  const status: TrekStatus = {
    kind: "triggers",
    name: "bot-code",
    triggers: [
      {
        trigger: {
          kind: "event",
          name: "a reply times out",
          evidence: { repo: "bot", file: "bot.py", line: 91 },
        },
        trek: { kind: "ready", name: "a-reply-times-out" },
      },
    ],
  }
  const frame = await frameOf({ entries: [wayIn], codeStatus: status, onBuildTrigger: noop })

  expect(frame).toContain("a reply times out")
  // its title is in the heading over the list, not on a row of its own
  expect(frame).not.toMatch(/A reply times out +12 steps +built/)
})

test("b on a way in whose trek is built rebuilds that trek", async () => {
  const status: TrekStatus = {
    kind: "triggers",
    name: "bot-code",
    triggers: [
      {
        trigger: {
          kind: "event",
          name: "a reply times out",
          evidence: { repo: "bot", file: "bot.py", line: 91 },
        },
        trek: { kind: "ready", name: "a-reply-times-out" },
      },
    ],
  }
  const built: string[] = []
  const app = (
    <App
      entries={[]}
      onOpen={noop}
      onQuit={noop}
      now={NOW}
      codeStatus={status}
      onBuildTrigger={(name) => built.push(name)}
    />
  )
  const frame = await frameAfter(app, (input) => input.pressKey("b"))

  expect(frame).toContain("b rebuild")
  expect(built).toEqual(["a reply times out"])
})

test("says a stale trek is out of date, how much changed, and offers to update it", async () => {
  const status: TrekStatus = { kind: "stale", name: "feature-refunds", staleStops: 3, stops: 12 }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toMatch(/│ ≠ stale/)
  expect(frame).toMatch(/│ feature-refunds/)
  expect(frame).toMatch(/│ 3 of 12 steps' files changed since/)
  expect(frame).toContain("b update")
})

test("says a trek built with an older guide still opens, and offers to rebuild it", async () => {
  const status: TrekStatus = { kind: "older-guide", name: "feature-refunds" }
  const editor = { id: "nvim", label: "Neovim", command: "nvim", steps: true }
  const frame = await frameOf({ entries: [refund], status, onBuild: noop, editor })

  expect(frame).toMatch(/│ ↻ older guide/)
  expect(frame).toMatch(/│ Refund orders/)
  expect(frame).toMatch(/│ built before the guide last changed/)
  expect(frame).toMatch(/▶ ↻ older guide +Refund orders +12 steps/)
  expect(frame).toContain("enter open · b rebuild · ? keys")
})

test("says a trek that can't be read, with its problem, and offers to rebuild it", async () => {
  const status: TrekStatus = {
    kind: "unreadable",
    name: "feature-refunds",
    problem: "format_version: Invalid input: expected 1",
  }
  const frame = await frameOf({ status, onBuild: noop })

  expect(frame).toMatch(/│ ✕ can't read/)
  expect(frame).toMatch(/│ format_version: Invalid input:/)
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

  expect(frame).toMatch(/│ ✕ can't open/)
  expect(frame).toMatch(/│ repo worker isn't at \.\.\/worker/)
  expect(frame).toMatch(/│ clone it there to open this trek/)
  expect(frame).toMatch(/▶ ✕ can't open +Refund orders +no worker at \.\.\/worker/)
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

test("? lists every key, grouped, in place of the list; any key closes it", async () => {
  const app = <App entries={[refund]} onOpen={noop} onQuit={noop} now={NOW} />
  const open = await frameAfter(app, (input) => input.pressKey("?"))

  expect(open).toContain("THE SELECTED ROW")
  expect(open).toMatch(/C +pick another change/)
  expect(open).toMatch(/q +quit/)
  expect(open).not.toMatch(/Refund orders +12 steps +built/)
  expect(open).toContain("any key close")

  const closed = await frameAfter(app, async (input) => {
    input.pressKey("?")
    await Bun.sleep(20)
    input.pressKey("j")
    await Bun.sleep(20)
  })
  expect(closed).toContain("Refund orders")
})
