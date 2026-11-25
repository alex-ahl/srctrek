import { useTerminalDimensions } from "@opentui/react"
import type { PullRequestDetails } from "@srctrek/core"
import type { BuildRead } from "../build-view/read"
import { PADDING } from "../ui/layout"
import { ChangeBody } from "./body"
import { ChangeFrame } from "./frame"
import { type ChangeViewProps, useChangeView } from "./use-change-view"

type Props = ChangeViewProps & {
  // a pull request's title, who opened it, and whether it's a draft, once known
  details?: PullRequestDetails | undefined
  // how a trek whose work is done ended, in a word; such a trek has no change to show
  done?: string | undefined
  // the latest build of the trek by this name
  readBuild: (name: string) => Promise<BuildRead>
}

/**
 * A change and its trek: what the change is, where its trek stands or its build as it runs, a
 * repo the agent proposed, and, once there's a trek, its overview, stepped from here.
 */
export function ChangeScreen(props: Props) {
  const { summary, status, proposal, actions } = props
  const { width } = useTerminalDimensions()
  const view = useChangeView(props)

  return (
    <ChangeFrame
      summary={summary}
      keys={view.keys}
      hints={view.hints}
      groups={view.groups}
      ask={view.ask}
    >
      <ChangeBody
        summary={summary}
        details={props.details}
        status={status}
        overview={view.overview}
        proposal={proposal}
        done={props.done}
        readBuild={props.readBuild}
        canBuild={actions.build !== undefined}
        width={width - 2 * PADDING}
      />
    </ChangeFrame>
  )
}
