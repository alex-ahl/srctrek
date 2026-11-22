import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { ChangeSummary, TrekStatus } from "@srctrek/core"
import { Footer } from "../ui/footer"
import { OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { ChangeBody } from "./body"
import { type ChangeActions, canStep, changeGroups, changeHints, changeKeys } from "./keys"
import { ChangeTitleBar } from "./title"
import { useOverview } from "./use-overview"

type Props = {
  // the folder trek runs in, where the change's trek is saved
  root: string
  // what the change is; absent when trek was started without one
  summary: ChangeSummary | undefined
  status: TrekStatus
  actions: ChangeActions
}

/**
 * A change and its trek: what the change is, where its trek stands, and, once there's a trek, its
 * overview, stepped from here.
 */
export function ChangeScreen({ root, summary, status, actions }: Props) {
  const { width } = useTerminalDimensions()
  const overview = useOverview(root, status.name, canStep(status))
  const help = useKeysHelp()
  const keys = new Map([...changeKeys(status, actions), ["?", help.show]])
  useKeyboard(help.guard((key) => keys.get(key.name)?.()))

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
        <OrKeysHelp open={help.open} groups={changeGroups(status, actions)}>
          <ChangeBody
            summary={summary}
            status={status}
            overview={overview}
            canBuild={actions.build !== undefined}
            width={width - 2 * PADDING}
          />
        </OrKeysHelp>
      </box>
      <Footer keys={help.footer(changeHints(status, actions))} shown="" />
    </box>
  )
}
