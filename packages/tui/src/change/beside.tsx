import type { OverviewView, ProposedRepo, TrekStatus } from "@srctrek/core"
import type { BuildRead } from "../build-view/read"
import type { Beside } from "../landing/beside"
import type { Rested } from "../preparing"
import type { ChangeOpen } from "../stack"
import { useTones } from "../ui/theme"
import { ChangeBody } from "./body"
import type { ChangeActions } from "./keys"
import type { OpenChange } from "./open-change"
import { type ChangeViewProps, useChangeView } from "./use-change-view"
import { WaysIn, wayRows } from "./ways-in"

type Props = Readonly<{
  // the change the landing page's selection rests on, worked out
  rested: Rested | undefined
  readOverview: (name: string) => Promise<OverviewView | undefined>
  readBuild: (name: string) => Promise<BuildRead>
  proposal: ProposedRepo | undefined
  // what the keys do to a change
  actionsFor: (change: OpenChange | undefined) => ChangeActions
  run: (work: Promise<void>) => void
  generation: number
  // the columns the change has beside the list
  width: number
  // code as it is, its ways in found, on a screen of its own, where each is chosen
  openWaysIn: (change: ChangeOpen) => void
}>

// What the view is driven from while there's no change to show: nothing to read or step.
const NOTHING: TrekStatus = { kind: "empty", name: "" }

const NO_KEYS: ReadonlyMap<string, () => void> = new Map()

const NOT_ASKING = { asking: undefined, closeAsk: () => undefined }

// Why the change rested on couldn't be opened, in its place.
function Failed({ why }: { why: string }) {
  const tones = useTones()
  return <text fg={tones.bad}>{`✕ couldn't open it: ${why}`}</text>
}

// A change that couldn't be opened: why, and no keys.
function failedBeside({ key, screen }: Rested): Beside {
  const why =
    screen.kind === "pending" && screen.pending.kind === "failed" ? screen.pending.why : ""
  return {
    key,
    body: <Failed why={why} />,
    keys: NO_KEYS,
    hints: [],
    group: undefined,
    ...NOT_ASKING,
  }
}

const WAYS_IN_HINTS = [{ key: "enter", does: "its ways in" }]

// Code as it is, its ways in found: those listed, and enter opening them, to choose one.
function waysInBeside(key: string, shown: ChangeOpen, props: Props): Beside {
  const ways = shown.status.kind === "triggers" ? shown.status.triggers : []
  return {
    key,
    body: <WaysIn rows={wayRows(ways)} selected={-1} width={props.width} />,
    keys: new Map([["return", () => props.openWaysIn(shown)]]),
    hints: WAYS_IN_HINTS,
    group: { title: "this change", keys: WAYS_IN_HINTS },
    ...NOT_ASKING,
  }
}

// What the change's view is driven from: the change rested on, or nothing while there's none.
function viewOf(
  shown: ChangeOpen | undefined,
  props: Props,
  actions: ChangeActions,
): ChangeViewProps {
  return {
    readOverview: props.readOverview,
    summary: shown?.change.summary,
    status: shown?.status ?? NOTHING,
    overview: shown?.overview,
    proposal: props.proposal,
    actions,
    run: props.run,
    generation: props.generation,
    enterBuilds: true,
  }
}

/**
 * The change the landing page's selection rests on, as it's shown beside the list: its screen's
 * body and keys, enter building a change with no trek; code as it is with its ways in found, those
 * listed, enter opening them; why it couldn't be opened.
 */
export function useChangeBeside(props: Props): Beside | undefined {
  const { rested } = props
  const shown = rested?.screen.kind === "change" ? rested.screen : undefined
  const actions = props.actionsFor(shown?.change)
  const view = useChangeView(viewOf(shown, props, actions))

  if (rested === undefined) {
    return undefined
  }

  if (shown === undefined) {
    return failedBeside(rested)
  }

  if (shown.status.kind === "triggers") {
    return waysInBeside(rested.key, shown, props)
  }

  return {
    key: rested.key,
    body: (
      <ChangeBody
        summary={shown.change.summary}
        details={shown.details}
        status={shown.status}
        overview={view.overview}
        proposal={props.proposal}
        done={undefined}
        readBuild={props.readBuild}
        canBuild={actions.build !== undefined}
        width={props.width}
      />
    ),
    keys: view.keys,
    hints: view.hints,
    group: view.group,
    asking: view.ask.asking,
    closeAsk: view.ask.close,
  }
}
