import type { ChangeSummary, OverviewView, TrekStatus } from "@srctrek/core"
import { Overview } from "../stepping/ends"
import { count } from "../ui/text"
import { useTones } from "../ui/theme"
import { useStateText } from "../ui/turning"
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

/**
 * A change's screen under its title: the change and how big it is, where its trek stands, and,
 * once there's a trek, its overview.
 */
export function ChangeBody({
  summary,
  status,
  overview,
  canBuild,
  width,
}: {
  summary: ChangeSummary | undefined
  status: TrekStatus
  overview: OverviewView | undefined
  canBuild: boolean
  width: number
}) {
  return (
    <box flexDirection="column">
      {summary !== undefined && <ChangeLine summary={summary} width={width} />}
      <text> </text>
      <StateBlock status={status} canBuild={canBuild} />
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
