import type {
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
  others: [{ name: "fix/rounding", commits: 1 }],
}

const pulls: OpenPullRequest[] = [
  {
    number: 12,
    title: "Add partial refunds",
    author: "alice",
    url: "https://github.com/acme/web/pull/12",
    draft: false,
    reviewRequested: true,
  },
]

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
    done={() => Promise.resolve([{ name: "spike", title: "Posting to the ledger", why: "merged" }])}
    from={undefined}
    onPick={noop}
    onSettings={noop}
    onQuit={noop}
    tint={undefined}
  />
)

// A change's screen with its trek where `status` says, and an agent to build it.
function change(
  status: TrekStatus,
  extra: { proposal?: ProposedRepo; agent?: boolean; summary?: ChangeSummary } = {},
) {
  return (
    <ChangeScreen
      root="."
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
  "change-proposal": change(
    { kind: "building", name: "feature-refunds", logTail: buildLog },
    { proposal: payments },
  ),
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
