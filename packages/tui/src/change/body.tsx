import type {
  ChangeSummary,
  OverviewView,
  ProposedRepo,
  PullRequestDetails,
  TrekStatus,
} from "@srctrek/core"
import type { BuildRead } from "../build-view/read"
import { Overview } from "../stepping/ends"
import { count } from "../ui/text"
import { useTones } from "../ui/theme"
import type { StateLabel } from "../ui/state-labels"
import { useStateText } from "../ui/turning"
import { Building } from "./building"
import { ChangeHeading } from "./line"
import { type Opened, statusBlock } from "./status-block"

// Where the trek stands: its symbol and state in the state's tone, then dim lines saying why; a
// trek whose work is done, how it ended.
function StateBlock(props: {
  status: TrekStatus
  done: string | undefined
  canBuild: boolean
  open: Opened
}) {
  const tones = useTones()
  const block =
    props.done === undefined
      ? statusBlock(props.status, undefined, props.canBuild, props.open)
      : { ...doneBlock(props.done), details: [] }
  const text = useStateText(block)

  return (
    <box flexDirection="column">
      <text fg={tones[block.tone]}>{text}</text>
      {block.details.map((line, i) => (
        <text key={i} fg={tones.dim}>{`  ${line}`}</text>
      ))}
    </box>
  )
}

const doneBlock = (why: string): StateLabel => ({ symbol: "✓", state: why, tone: "dim" })

// The steps the agent marked likely wrong, said before the trek is stepped.
function Flags({ overview }: { overview: OverviewView }) {
  const tones = useTones()
  const high = overview.flags.high
  if (high === 0) {
    return undefined
  }

  return <text fg={tones.bad}>{`⚠ ${count(high, "step")} likely wrong`}</text>
}

// A repo the agent went into that the change doesn't hold, for the user to add or dismiss.
function Proposal({ proposal }: { proposal: ProposedRepo }) {
  const tones = useTones()
  return (
    <text fg={tones.accent}>
      {"? "}
      <span fg={tones.dim}>the agent went into </span>
      {proposal.name}
      <span fg={tones.dim}>{`   ${proposal.reason}`}</span>
    </text>
  )
}

// What's open, as the state words it: code as it is, from a trigger or not, else a change.
const openedOf = (summary: ChangeSummary | undefined): Opened => ({
  code: summary?.code ?? false,
  trigger: summary?.trigger,
})

/**
 * A change's screen under its title: the change and how big it is, where its trek stands, or the
 * build as it runs, a repo the agent proposed, and, once there's a trek, its overview.
 */
export function ChangeBody({
  summary,
  details,
  status,
  overview,
  proposal,
  done,
  readBuild,
  canBuild,
  width,
}: {
  summary: ChangeSummary | undefined
  // a pull request's title, who opened it, and whether it's a draft, once known
  details: PullRequestDetails | undefined
  status: TrekStatus
  overview: OverviewView | undefined
  proposal: ProposedRepo | undefined
  // how a trek whose work is done ended, in a word
  done: string | undefined
  // the latest build of the trek by this name, as it stands
  readBuild: (name: string) => Promise<BuildRead>
  canBuild: boolean
  width: number
}) {
  return (
    <box flexDirection="column">
      {summary !== undefined && (
        <box flexDirection="column">
          <ChangeHeading summary={summary} details={details} width={width} />
          <text> </text>
        </box>
      )}
      {status.kind === "building" ? (
        <Building name={status.name} read={readBuild} width={width} />
      ) : (
        <StateBlock status={status} done={done} canBuild={canBuild} open={openedOf(summary)} />
      )}
      {proposal !== undefined && (
        <box flexDirection="column">
          <text> </text>
          <Proposal proposal={proposal} />
        </box>
      )}
      {overview !== undefined && (
        <box flexDirection="column">
          <text> </text>
          <Overview view={overview} width={width} />
          <Flags overview={overview} />
        </box>
      )}
    </box>
  )
}
