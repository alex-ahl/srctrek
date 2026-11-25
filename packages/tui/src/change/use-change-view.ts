import {
  type ChangeSummary,
  type OverviewView,
  type ProposedRepo,
  type TrekStatus,
  findsWaysIn,
} from "@srctrek/core"
import { useAsk } from "./frame"
import { type ChangeActions, canStep, changeGroup, changeHints, changeKeys } from "./keys"
import { useOverview } from "./use-overview"

/** What a change's view is drawn and driven from, wherever it's shown. */
export type ChangeViewProps = Readonly<{
  // reads a saved trek's overview, by its name
  readOverview: (name: string) => Promise<OverviewView | undefined>
  // what the change is; absent for a trek whose change is gone
  summary: ChangeSummary | undefined
  // where the trek stands, and the first repo proposed that's still unsettled
  status: TrekStatus
  // the trek's overview, when it was read before the view was shown
  overview?: OverviewView | undefined
  proposal: ProposedRepo | undefined
  actions: ChangeActions
  // runs work a key started, for where things stand to be read again once it's under way
  run: (work: Promise<void>) => void
  // moves on when the worktree has, for the trek's overview to be read again
  generation: number
  // beside the landing page's list, enter builds a change with no trek to step
  enterBuilds?: boolean | undefined
}>

/**
 * A change's view as it stands: its trek's overview once there's one to step, its keys, the
 * footer's hints and their place on `?`, and a question asked in the footer's place.
 */
export function useChangeView(props: ChangeViewProps) {
  const { summary, status, proposal, actions, run } = props
  const overview = useOverview(
    props.readOverview,
    status.name,
    canStep(status),
    props.generation,
    props.overview,
  )
  const ask = useAsk()

  const context = {
    status,
    findsWaysIn: summary !== undefined && findsWaysIn(summary),
    proposal,
    run,
    ask: ask.ask,
    enterBuilds: props.enterBuilds,
  }

  return {
    overview,
    ask,
    keys: changeKeys(context, actions),
    hints: changeHints(context, actions),
    group: changeGroup(context, actions),
  }
}
