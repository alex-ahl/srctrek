import { useTerminalDimensions } from "@opentui/react"
import type { ChangeSummary, ProposedRepo, TrekStatus } from "@srctrek/core"
import type { BuildRead } from "../build-view/read"
import { PADDING } from "../ui/layout"
import { ChangeBody } from "./body"
import { ChangeFrame, useAsk } from "./frame"
import { type ChangeActions, canStep, changeGroups, changeHints, changeKeys } from "./keys"
import { useOverview } from "./use-overview"

type Props = {
  // the folder trek runs in, where the change's trek is saved
  root: string
  // what the change is; absent for a trek whose change is gone
  summary: ChangeSummary | undefined
  // where the trek stands, and the first repo proposed that's still unsettled
  status: TrekStatus
  proposal: ProposedRepo | undefined
  // the latest build of the trek by this name
  readBuild: (name: string) => Promise<BuildRead>
  actions: ChangeActions
  // runs work a key started, for where things stand to be read again once it's under way
  run: (work: Promise<void>) => void
  // moves on when the worktree has, for the trek's overview to be read again
  generation: number
}

/**
 * A change and its trek: what the change is, where its trek stands or its build as it runs, a
 * repo the agent proposed, and, once there's a trek, its overview, stepped from here.
 */
export function ChangeScreen(props: Props) {
  const { root, summary, status, proposal, actions, run } = props
  const { width } = useTerminalDimensions()
  const overview = useOverview(root, status.name, canStep(status), props.generation)
  const ask = useAsk()

  const findsWaysIn = summary?.code === true && summary.trigger === undefined
  const context = { status, findsWaysIn, proposal, run, ask: ask.ask }

  return (
    <ChangeFrame
      summary={summary}
      keys={changeKeys(context, actions)}
      hints={changeHints(context, actions)}
      groups={changeGroups(context, actions)}
      ask={ask}
    >
      <ChangeBody
        summary={summary}
        status={status}
        overview={overview}
        proposal={proposal}
        readBuild={props.readBuild}
        canBuild={actions.build !== undefined}
        width={width - 2 * PADDING}
      />
    </ChangeFrame>
  )
}
