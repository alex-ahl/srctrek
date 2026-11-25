import { useKeyboard } from "@opentui/react"
import type { ChangeSummary } from "@srctrek/core"
import { type ReactNode, useState } from "react"
import { Footer, type KeyHint } from "../ui/footer"
import { type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { TextPrompt } from "../ui/text-prompt"
import type { Ask } from "./keys"
import { ChangeTitleBar } from "./title"

// A letter typed with shift as its capital, "B", so maps name capitals as they're shown.
const shifted = (key: Readonly<{ name: string; shift: boolean }>) =>
  key.shift && key.name.length === 1 ? key.name.toUpperCase() : key.name

/** A question in the footer's place, while one is asked, and how a screen asks one. */
export function useAsk() {
  const [asking, setAsking] = useState<Ask | undefined>(undefined)
  return { asking, ask: setAsking, close: () => setAsking(undefined) }
}

type Props = {
  summary: ChangeSummary | undefined
  keys: ReadonlyMap<string, () => void>
  hints: KeyHint[]
  groups: KeyGroup[]
  ask: ReturnType<typeof useAsk>
  children: ReactNode
}

/**
 * A change's screen around what it shows: the change in the title bar, the body with every key in
 * its place on `?`, and the footer, or the question asked in its place, which takes the keys.
 */
export function ChangeFrame({ summary, keys, hints, groups, ask, children }: Props) {
  const help = useKeysHelp()
  const { asking, close } = ask
  const all = new Map([...keys, ["?", help.show]])
  useKeyboard(help.guard((key) => asking === undefined && all.get(shifted(key))?.()))

  const answer = (text: string) => {
    close()
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
        <OrKeysHelp open={help.open} groups={groups}>
          {children}
        </OrKeysHelp>
      </box>
      {asking === undefined ? (
        <Footer keys={help.footer(hints)} />
      ) : (
        <TextPrompt
          question={asking.question}
          hint={asking.hint}
          onSubmit={answer}
          onCancel={close}
        />
      )}
    </box>
  )
}
