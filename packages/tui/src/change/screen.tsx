import { useTerminalDimensions } from "@opentui/react"
import type {
  ChangeSummary,
  OverviewView,
  ProposedRepo,
  PullRequestDetails,
  TrekStatus,
} from "@srctrek/core"
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
  // a pull request's title, who opened it, and whether it's a draft, once known
  details?: PullRequestDetails | undefined
  // where the trek stands, and the first repo proposed that's still unsettled
  status: TrekStatus
  // the trek's overview, when it was read before the screen opened
  overview?: OverviewView | undefined
  proposal: ProposedRepo | undefined
  // how a trek whose work is done ended, in a word; such a trek has no change to show
  done?: string | undefined
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
  const overview = useOverview(root, status.name, canStep(status), props.generation, props.overview)
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
        details={props.details}
        status={status}
        overview={overview}
        proposal={proposal}
        done={props.done}
        readBuild={props.readBuild}
        canBuild={actions.build !== undefined}
        width={width - 2 * PADDING}
      />
    </ChangeFrame>
  )
}
