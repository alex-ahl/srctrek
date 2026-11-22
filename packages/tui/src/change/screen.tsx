import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { ChangeSummary, ProposedRepo, TrekStatus } from "@srctrek/core"
import { type ReactNode, useState } from "react"
import type { BuildRead } from "../build-view/read"
import { useBuildWatch } from "../home/watch/use-build-watch"
import { Footer, type KeyHint } from "../ui/footer"
import { type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { moveKeys } from "../ui/move"
import { TextPrompt } from "../ui/text-prompt"
import { ChangeBody } from "./body"
import {
  type Ask,
  type ChangeActions,
  type KeyContext,
  canStep,
  changeGroups,
  changeHints,
  changeKeys,
} from "./keys"
import { ChangeTitleBar } from "./title"
import { useOverview } from "./use-overview"
import {
  type WaysInActions,
  WaysIn,
  movedKey,
  selectedRow,
  wayRows,
  waysGroups,
  waysHints,
  waysKeys,
} from "./ways-in"

/** Where the screen reads, as they change, the trek, its latest build, and the repos proposed. */
export type ChangeReads = Readonly<{
  status: () => Promise<TrekStatus>
  build: () => Promise<BuildRead>
  proposals: () => Promise<ProposedRepo[]>
}>

type Props = {
  // the folder trek runs in, where the change's trek is saved
  root: string
  // what the change is; absent when trek was started without one
  summary: ChangeSummary | undefined
  // where the trek and the proposals stood as the screen opened
  status: TrekStatus
  proposals: ProposedRepo[]
  reads: ChangeReads
  actions: ChangeActions
  // for code as it is with no trigger, what its ways in offer once found
  waysIn?: WaysInActions | undefined
}

/**
 * Where the trek stands and the repos proposed, read again once work a key started is under way,
 * and while a build runs.
 */
function useStanding(first: Props, reads: ChangeReads) {
  const [status, setStatus] = useState(first.status)
  const [proposals, setProposals] = useState(first.proposals)
  const readProposals = async () => setProposals(await reads.proposals())
  const run = (work: Promise<void>) =>
    void work.then(async () => {
      setStatus(await reads.status())
      await readProposals()
    })

  useBuildWatch(status, reads.status, { status: setStatus, ended: readProposals })
  return { status, proposal: proposals[0], run }
}

// What the screen shows under the change, and its keys, footer, and ? panel.
type Shown = Readonly<{
  body: ReactNode
  keys: ReadonlyMap<string, () => void>
  hints: KeyHint[]
  groups: KeyGroup[]
}>

/** The code's ways in, once found: chosen with ↑/↓, the selection kept by its key. */
function useWaysIn(
  status: TrekStatus,
  waysIn: WaysInActions | undefined,
  context: KeyContext,
  actions: ChangeActions,
  width: number,
): Shown | undefined {
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  if (status.kind !== "triggers" || waysIn === undefined) {
    return undefined
  }

  const rows = wayRows(status.triggers)
  const selected = selectedRow(rows, chosen)
  const ways = { ...context, row: rows[selected], actions: waysIn, find: actions.build }
  const move = (by: number) => setChosen(movedKey(rows, selected, by))
  return {
    body: <WaysIn rows={rows} selected={selected} width={width} />,
    keys: new Map([
      ...waysKeys(ways),
      ...moveKeys(move),
      ["escape", actions.back],
      ["q", actions.back],
    ]),
    hints: waysHints(ways),
    groups: waysGroups(ways),
  }
}

// A letter typed with shift as its capital, "B", so maps name capitals as they're shown.
const shifted = (key: Readonly<{ name: string; shift: boolean }>) =>
  key.shift && key.name.length === 1 ? key.name.toUpperCase() : key.name

/**
 * A change and its trek: what the change is, where its trek stands or its build as it runs, the
 * repos the agent proposed, and, once there's a trek, its overview, stepped from here. For code
 * as it is, its ways in, once found, each with its trek.
 */
export function ChangeScreen(props: Props) {
  const { root, summary, reads, actions } = props
  const { width } = useTerminalDimensions()
  const room = width - 2 * PADDING
  const { status, proposal, run } = useStanding(props, reads)
  const overview = useOverview(root, status.name, canStep(status))
  const [asking, setAsking] = useState<Ask | undefined>(undefined)
  const help = useKeysHelp()

  const findsWaysIn = summary?.code === true && summary.trigger === undefined
  const context = { status, findsWaysIn, proposal, run, ask: setAsking }
  const ways = useWaysIn(status, props.waysIn, context, actions, room)
  const shown: Shown = ways ?? {
    body: (
      <ChangeBody
        summary={summary}
        status={status}
        overview={overview}
        proposal={proposal}
        readBuild={reads.build}
        canBuild={actions.build !== undefined}
        width={room}
      />
    ),
    keys: changeKeys(context, actions),
    hints: changeHints(context, actions),
    groups: changeGroups(context, actions),
  }
  const keys = new Map([...shown.keys, ["?", help.show]])
  useKeyboard(help.guard((key) => asking === undefined && keys.get(shifted(key))?.()))

  const answer = (text: string) => {
    setAsking(undefined)
    asking?.answer(text)
  }

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <ChangeTitleBar summary={summary} />
      <box
        flexDirection="column"
        style={{
          flexGrow: 1,
          paddingTop: 1,
          paddingLeft: PADDING,
          paddingRight: PADDING,
          overflow: "hidden",
        }}
      >
        <OrKeysHelp open={help.open} groups={shown.groups}>
          {shown.body}
        </OrKeysHelp>
      </box>
      {asking === undefined ? (
        <Footer keys={help.footer(shown.hints)} shown="" />
      ) : (
        <TextPrompt
          question={asking.question}
          hint={asking.hint}
          onSubmit={answer}
          onCancel={() => setAsking(undefined)}
        />
      )}
    </box>
  )
}
