import type { ChangeSummary, ProposedRepo, TrekEntry, TrekStatus, TriggerTrek } from "@srctrek/core"
import type { ReactNode } from "react"
import { App } from "../../src/home/app"

const noop = () => undefined

const treks: TrekEntry[] = [
  {
    name: "feature-refunds",
    path: "/r/feature-refunds.json",
    valid: true,
    title: "Full refund of order o_1001: button click to the payment provider",
    steps: 19,
    highFlags: 1,
    createdAt: "2026-11-09T09:12:00.000Z",
    repos: 1,
    code: false,
    heads: [{ repo: "web", head: { kind: "branch", name: "feature/refunds", uncommitted: false } }],
  },
  {
    name: "pr-12",
    path: "/r/pr-12.json",
    valid: true,
    title: "Partial refunds split across two payments",
    steps: 14,
    highFlags: 0,
    createdAt: "2026-11-08T16:40:00.000Z",
    repos: 1,
    code: false,
    heads: [{ repo: "web", head: { kind: "branch", name: "feature/refunds", uncommitted: false } }],
  },
  {
    name: "orientation",
    path: "/r/orientation.json",
    valid: true,
    title: "How a refund request reaches the worker",
    steps: 15,
    highFlags: 0,
    createdAt: "2026-10-21T11:05:00.000Z",
    repos: 1,
    code: true,
    heads: [{ repo: "web", head: { kind: "branch", name: "feature/refunds", uncommitted: false } }],
  },
  {
    name: "pr-9",
    path: "/r/pr-9.json",
    valid: false,
    problem: "steps.3 (s4).via: a link from another repo cites one side only",
  },
]

// Reviewing feature/refunds in web, through the api and the worker, on the morning of Nov 9.
const NOW = new Date("2026-11-09T10:30:00.000Z")

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

// A branch still where it left main.
const emptySummary: ChangeSummary = {
  ...summary,
  changed: summary.changed.map((repo) => ({ ...repo, commits: 0 })),
}

const codeSummary: ChangeSummary = { changed: [], unchanged: ["api"], code: true }

const payments: ProposedRepo = {
  name: "payments",
  source: "../payments-service",
  reason: "the worker calls it at /v2/refunds",
  evidence: [{ repo: "worker", file: "worker/main.py", line: 41 }],
}

const buildLog = [
  'trek: started "Full refund of order o_1001"',
  "trek: read_file api src/handlers/refunds.ts 1–60 → 2140 chars",
  "trek: added s8–s14; the trek has s1–s14",
  "trek: read_file worker worker/main.py 1–80 → 2630 chars",
]

const triggers: TriggerTrek[] = [
  {
    trigger: {
      kind: "request",
      name: "POST /refunds",
      evidence: { repo: "api", file: "src/routes.ts", line: 12 },
    },
    trek: { kind: "ready", name: "post-refunds" },
  },
  {
    trigger: {
      kind: "command",
      name: "import-orders",
      evidence: { repo: "api", file: "src/cli.ts", line: 30 },
    },
    trek: { kind: "missing", name: "import-orders" },
  },
  {
    trigger: {
      kind: "schedule",
      name: "nightly cart expiry",
      evidence: { repo: "api", file: "src/jobs.ts", line: 8 },
    },
    trek: { kind: "building", name: "nightly-cart-expiry", logTail: [] },
  },
]

// The home screen with the change's trek where `status` says, and an agent to build it.
function home(
  status: TrekStatus | undefined,
  extra: { proposals?: ProposedRepo[]; agent?: boolean; summary?: ChangeSummary } = {},
) {
  // a change with no trek yet has none of its own in the list
  const entries =
    status !== undefined && status.kind !== "missing" && status.kind !== "empty"
      ? treks
      : treks.slice(1)
  const build = extra.agent === false ? undefined : noop

  return (
    <App
      entries={entries}
      onOpen={noop}
      onQuit={noop}
      status={status}
      onBuild={build}
      onBuildTrigger={build}
      onShowLog={noop}
      proposals={extra.proposals ?? []}
      onAddRepo={noop}
      onDismissRepo={noop}
      summary={extra.summary ?? summary}
      now={NOW}
    />
  )
}

/** Every screen and state the terminal draws, by name, with sample data from the refund flow. */
export const SCREENS: Readonly<Record<string, ReactNode>> = {
  "home-ready": home({ kind: "ready", name: "feature-refunds" }),
  "home-proposal": home({ kind: "ready", name: "feature-refunds" }, { proposals: [payments] }),
  "home-building": home({ kind: "building", name: "feature-refunds", logTail: buildLog }),
  "home-failed": home({
    kind: "failed",
    name: "feature-refunds",
    logTail: [
      "trek: rejected s15: crosses from api to worker without citing worker",
      "trek: stopped after 3 rejected rounds",
    ],
  }),
  "home-stale": home({ kind: "stale", name: "feature-refunds", staleStops: 4, stops: 19 }),
  "home-older-guide": home({ kind: "older-guide", name: "feature-refunds" }),
  "home-unreadable": home({
    kind: "unreadable",
    name: "feature-refunds",
    problem: "format_version: Invalid input: expected 1",
  }),
  "home-unreachable": home({
    kind: "unreachable",
    name: "feature-refunds",
    unreachable: {
      repo: "worker",
      source: "../worker",
      revision: "4f1c2a9e0b7d3c5a8e6f1b2d4c7a9e0f3b5d8c1a",
      reason: "missing",
    },
  }),
  "home-missing": home({ kind: "missing", name: "feature-refunds" }),
  "home-no-agent": home({ kind: "missing", name: "feature-refunds" }, { agent: false }),
  "home-empty": home({ kind: "empty", name: "feature-refunds" }, { summary: emptySummary }),
  "home-triggers": home({ kind: "triggers", name: "api-code", triggers }, { summary: codeSummary }),
  "home-no-change": home(undefined),
}
