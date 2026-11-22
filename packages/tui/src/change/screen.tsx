import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { ChangeSummary, ProposedRepo, TrekStatus } from "@srctrek/core"
import { useState } from "react"
import type { BuildRead } from "../build-view/read"
import { useBuildWatch } from "../home/watch/use-build-watch"
import { Footer } from "../ui/footer"
import { OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { TextPrompt } from "../ui/text-prompt"
import { ChangeBody } from "./body"
import { type ChangeActions, canStep, changeGroups, changeHints, changeKeys } from "./keys"
import { ChangeTitleBar } from "./title"
import { useOverview } from "./use-overview"

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

/**
 * A change and its trek: what the change is, where its trek stands or its build as it runs, the
 * repos the agent proposed, and, once there's a trek, its overview, stepped from here.
 */
export function ChangeScreen(props: Props) {
  const { root, summary, reads, actions } = props
  const { width } = useTerminalDimensions()
  const { status, proposal, run } = useStanding(props, reads)
  const overview = useOverview(root, status.name, canStep(status))
  const [asking, setAsking] = useState<string | undefined>(undefined)
  const help = useKeysHelp()

  const context = { status, proposal, run, askLocation: setAsking }
  const keys = new Map([...changeKeys(context, actions), ["?", help.show]])
  useKeyboard(help.guard((key) => asking === undefined && keys.get(key.name)?.()))

  const add = (location: string) => {
    setAsking(undefined)
    if (proposal !== undefined) {
      run(actions.addRepo(proposal.name, location))
    }
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
        <OrKeysHelp open={help.open} groups={changeGroups(context, actions)}>
          <ChangeBody
            summary={summary}
            status={status}
            overview={overview}
            proposal={proposal}
            readBuild={reads.build}
            canBuild={actions.build !== undefined}
            width={width - 2 * PADDING}
          />
        </OrKeysHelp>
      </box>
      {asking === undefined ? (
        <Footer keys={help.footer(changeHints(context, actions))} shown="" />
      ) : (
        <TextPrompt
          question={`Where does ${asking} live? A path or URL, esc to cancel:`}
          onSubmit={add}
          onCancel={() => setAsking(undefined)}
        />
      )}
    </box>
  )
}
