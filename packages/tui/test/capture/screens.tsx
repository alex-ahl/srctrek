import type {
  OverviewView,
  BranchChoices,
  ChangeSummary,
  OpenPullRequest,
  ProposedRepo,
  TrekStatus,
  TriggerTrek,
} from "@srctrek/core"
import type { ReactNode } from "react"
import type { BuildRead } from "../../src/build-view/read"
import { ChangeScreen } from "../../src/change/screen"
import { WaysInScreen } from "../../src/change/ways-in-screen"
import { Landing } from "../../src/landing/screen"

const noop = () => undefined
const done = () => Promise.resolve()

const choices: BranchChoices = {
  base: "main",
  own: { name: "feature/refunds", commits: 9 },
  uncommittedFiles: 2,
  others: [{ name: "fix/rounding", commits: 1, mine: true }],
}

const pulls: OpenPullRequest[] = [
  {
    number: 12,
    title: "Add partial refunds",
    author: "alice",
    url: "https://github.com/acme/web/pull/12",
    draft: false,
    reviewRequested: true,
    mine: false,
    head: "a12",
    base: "main",
    updatedAt: "2026-11-23T10:00:00Z",
    commits: 3,
  },
]

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

const NO_BUILD: BuildRead = {
  log: [],
  steps: [],
  state: undefined,
  started: undefined,
  ended: undefined,
  count: 0,
}

// The landing page, on a branch an agent has worked on.
const landing = (
  <Landing
    load={() => Promise.resolve(choices)}
    pullRequests={() => Promise.resolve(pulls)}
    nearby={() => Promise.resolve([])}
    repoBranches={() => Promise.reject(new Error("unread"))}
    fetchRepo={done}
    status={() => Promise.resolve({ kind: "missing", name: "feature-refunds" })}
    entries={() => Promise.resolve([])}
    pullStatus={() => Promise.resolve({ kind: "missing", name: "pr-12" })}
    done={() => Promise.resolve([{ name: "spike", title: "Posting to the ledger", why: "merged" }])}
    onPick={noop}
    onSettings={noop}
    onQuit={noop}
    tint={undefined}
  />
)

// A busy repo's landing page: pull requests waiting and not, branches with treks in every state.
const busyStates: Readonly<Record<string, TrekStatus>> = {
  "fix/rounding": { kind: "stale", name: "fix-rounding", staleStops: 2, stops: 9 },
  "feature/partial-refunds": { kind: "ready", name: "feature-partial-refunds" },
  "chore/upgrade-bun": { kind: "missing", name: "chore-upgrade-bun" },
  "feature/payout-retries": { kind: "building", name: "feature-payout-retries", logTail: [] },
  "spike/ledger-v2": { kind: "failed", name: "spike-ledger-v2", logTail: [] },
}

const busyPull = (
  number: number,
  title: string,
  author: string,
  more: Partial<OpenPullRequest> = {},
): OpenPullRequest => ({
  number,
  title,
  author,
  url: `https://github.com/acme/web/pull/${number}`,
  draft: false,
  reviewRequested: false,
  mine: false,
  head: `h${number}`,
  base: "main",
  updatedAt: "2026-11-23T10:00:00Z",
  commits: 3,
  ...more,
})

const busyPulls: OpenPullRequest[] = [
  busyPull(12, "Add partial refunds", "alice", { reviewRequested: true }),
  busyPull(
    15,
    "Retry failed payouts with exponential backoff and a dead-letter queue for the ones that keep failing",
    "bo",
    { reviewRequested: true },
  ),
  busyPull(14, "Round refunds to cents", "bo", { draft: true }),
  busyPull(9, "Upgrade the HTTP client", "carol"),
]

const busyPullStates: Readonly<Record<number, TrekStatus>> = {
  12: { kind: "ready", name: "pr-12" },
  14: { kind: "stale", name: "pr-14", staleStops: undefined, stops: 5 },
}

const landingBusy = (
  <Landing
    load={() =>
      Promise.resolve({
        base: "main",
        own: { name: "feature/refunds", commits: 9 },
        uncommittedFiles: 4,
        others: Object.keys(busyStates).map((name, at) => ({
          name,
          commits: at * 3 + 1,
          mine: true,
        })),
      })
    }
    pullRequests={() => Promise.resolve(busyPulls)}
    nearby={() => Promise.resolve([])}
    repoBranches={() => Promise.reject(new Error("unread"))}
    fetchRepo={done}
    status={(choice) =>
      Promise.resolve(
        choice.kind === "branch"
          ? (busyStates[choice.name] ?? { kind: "missing", name: "branch" })
          : choice.kind === "own" && !choice.uncommitted
            ? { kind: "ready", name: "feature-refunds" }
            : { kind: "missing", name: "feature-refunds-uncommitted" },
      )
    }
    entries={() => Promise.resolve([])}
    pullStatus={({ number }) =>
      Promise.resolve(busyPullStates[number] ?? { kind: "missing", name: `pr-${number}` })
    }
    done={() =>
      Promise.resolve([
        { name: "coupons", title: "Applying a coupon", why: "merged" },
        { name: "ledger", title: "Posting to the ledger", why: "branch gone" },
        { name: "webhooks", title: "Refund webhooks to the shop", why: "merged" },
      ])
    }
    onPick={noop}
    onSettings={noop}
    onQuit={noop}
    tint={undefined}
  />
)

// The refund trek's overview, for a change whose trek is saved.
const overview: OverviewView = {
  kind: "overview",
  title: "Partial refund of order o_1002",
  overview: "A partial refund posted from the order page reaches the ledger and the queue.",
  trigger: { kind: "request", input: "POST /refunds with { order: o_1002, amount: 40 }" },
  outcome: "a ledger row, and refund.created on the queue",
  count: 14,
  repos: ["web", "api", "worker"],
  flags: { high: 1, medium: 0, low: 0 },
}

// A change's screen with its trek where `status` says, and an agent to build it.
function change(
  status: TrekStatus,
  extra: { proposal?: ProposedRepo; agent?: boolean; summary?: ChangeSummary } = {},
) {
  return (
    <ChangeScreen
      readOverview={() => Promise.resolve(overview)}
      summary={extra.summary ?? summary}
      status={status}
      proposal={extra.proposal}
      readBuild={() => Promise.resolve({ ...NO_BUILD, log: buildLog, state: "building" })}
      actions={{
        step: noop,
        editor: undefined,
        editorFirst: false,
        build: extra.agent === false ? undefined : done,
        stop: done,
        builds: noop,
        addRepo: done,
        dismissRepo: done,
        back: noop,
      }}
      run={noop}
      generation={0}
    />
  )
}

// The code as it is, its ways in found.
const waysIn = (
  <WaysInScreen
    summary={codeSummary}
    ways={triggers}
    actions={{ stepTrek: noop, buildTrigger: done, follow: noop }}
    find={done}
    run={noop}
    back={noop}
  />
)

/** Every screen and state the terminal draws, by name, with sample data from the refund flow. */
export const SCREENS: Readonly<Record<string, ReactNode>> = {
  landing,
  "landing-busy": landingBusy,
  "change-proposal": change(
    { kind: "building", name: "feature-refunds", logTail: buildLog },
    { proposal: payments },
  ),
  "change-ready": change({ kind: "ready", name: "feature-refunds" }),
  "change-stale": change({ kind: "stale", name: "feature-refunds", staleStops: 4, stops: 14 }),
  "change-building": change({ kind: "building", name: "feature-refunds", logTail: buildLog }),
  "change-failed": change({
    kind: "failed",
    name: "feature-refunds",
    logTail: [
      "trek: rejected s15: crosses from api to worker without citing worker",
      "trek: stopped after 3 rejected rounds",
    ],
  }),
  "change-unreadable": change({
    kind: "unreadable",
    name: "feature-refunds",
    problem: "format_version: Invalid input: expected 1",
  }),
  "change-unreachable": change({
    kind: "unreachable",
    name: "feature-refunds",
    unreachable: {
      repo: "worker",
      source: "../worker",
      revision: "4f1c2a9e0b7d3c5a8e6f1b2d4c7a9e0f3b5d8c1a",
      reason: "missing",
    },
  }),
  "change-missing": change({ kind: "missing", name: "feature-refunds" }),
  "change-no-agent": change({ kind: "missing", name: "feature-refunds" }, { agent: false }),
  "change-empty": change({ kind: "empty", name: "feature-refunds" }, { summary: emptySummary }),
  "code-ways-in": waysIn,
}
