import type { ChangeSummary, OverviewView, ProposedRepo, TrekStatus } from "@srctrek/core"
import type { BuildRead } from "../build-view/read"
import { Overview } from "../stepping/ends"
import { count } from "../ui/text"
import { useTones } from "../ui/theme"
import { useStateText } from "../ui/turning"
import { Building } from "./building"
import { ChangeLine } from "./line"
import { statusBlock } from "./status-block"

// Where the trek stands: its symbol and state in the state's tone, then dim lines saying why.
function StateBlock({ status, canBuild }: { status: TrekStatus; canBuild: boolean }) {
  const tones = useTones()
  const block = statusBlock(status, undefined, canBuild)
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

/**
 * A change's screen under its title: the change and how big it is, where its trek stands, or the
 * build as it runs, a repo the agent proposed, and, once there's a trek, its overview.
 */
export function ChangeBody({
  summary,
  status,
  overview,
  proposal,
  readBuild,
  canBuild,
  width,
}: {
  summary: ChangeSummary | undefined
  status: TrekStatus
  overview: OverviewView | undefined
  proposal: ProposedRepo | undefined
  readBuild: () => Promise<BuildRead>
  canBuild: boolean
  width: number
}) {
  return (
    <box flexDirection="column">
      {summary !== undefined && <ChangeLine summary={summary} width={width} />}
      <text> </text>
      {status.kind === "building" ? (
        <Building read={readBuild} width={width} />
      ) : (
        <StateBlock status={status} canBuild={canBuild} />
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
