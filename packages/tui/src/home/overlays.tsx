import type { ChangeChoice, TrekEntry } from "@srctrek/core"
import type { RGBA } from "@opentui/core"
import { type ReactNode, useCallback } from "react"
import { ChangePicker } from "../change-picker/screen"
import { EditorPicker } from "../editors/editor-picker"
import { SettingsScreen } from "../settings/screen"
import { BuildScreen } from "../build-view/screen"
import type { Editor } from "../editors/editors"
import { TextPrompt } from "../ui/text-prompt"
import type { Choosing, Props } from "./screen"

// What the bottom of the screen is asking, when it's asking: where a proposed repo lives, or which
// editor treks open in, with the trek to open once it's picked.
export type Prompt =
  { kind: "location"; name: string } | { kind: "editor"; then?: TrekEntry | undefined }

// The bottom of the screen: the prompt that's open, else the footer.
export function Bottom({
  prompt,
  props,
  footer,
  close,
}: {
  prompt: Prompt | undefined
  props: Props
  footer: ReactNode
  close: () => void
}) {
  if (prompt === undefined) {
    return footer
  }

  if (prompt.kind === "location") {
    const { name } = prompt
    const add = (location: string) => {
      close()
      props.onAddRepo?.(name, location)
    }
    const question = `Where does ${name} live? A path or URL, esc to cancel:`
    return <TextPrompt question={question} onSubmit={add} onCancel={close} />
  }

  const { then } = prompt
  const pick = (editor: Editor) => {
    close()
    props.onChooseEditor?.(editor)
    if (then !== undefined) {
      props.onOpen(then)
    }
  }

  return (
    <EditorPicker
      editors={props.editors ?? []}
      current={props.editor}
      onPick={pick}
      onCancel={close}
      tint={props.tint}
    />
  )
}

// The change picker, over the list; picking closes it and reopens the home screen on the pick.
export function Picker({
  choosing,
  tint,
  close,
}: {
  choosing: Choosing
  tint: RGBA | undefined
  close: () => void
}) {
  const pick = (choice: ChangeChoice) => {
    close()
    choosing.onPick(choice)
  }

  return (
    <ChangePicker
      choice={choosing.choice}
      load={choosing.load}
      pullRequests={choosing.pullRequests}
      nearby={choosing.nearby}
      repoBranches={choosing.repoBranches}
      fetchRepo={choosing.fetchRepo}
      status={choosing.status}
      onPick={pick}
      onBack={close}
      tint={tint}
    />
  )
}

// What can open over the list, which keeps its selection for when it closes.
export type Over = "settings" | "picker" | Readonly<{ kind: "build"; name: string }>

// The screen open over the list, if any: the picker only where there's a change to choose.
export function overlayFor(over: Over | undefined, props: Props, close: () => void): ReactNode {
  if (over === "settings") {
    return <Settings props={props} close={close} />
  }

  if (typeof over === "object") {
    return <Build name={over.name} props={props} close={close} />
  }

  if (over !== "picker" || props.choosing === undefined) {
    return undefined
  }

  return <Picker choosing={props.choosing} tint={props.tint} close={close} />
}

// A build as it happens, over the list: the change's own, which b builds again, or a way in's.
function Build({ name, props, close }: { name: string; props: Props; close: () => void }) {
  const { onReadBuild, onStopBuild, onBuild, status, summary } = props
  const read = useCallback(
    () => onReadBuild?.(name) ?? Promise.reject(new Error("unread")),
    [onReadBuild, name],
  )
  const isChange = status?.name === name

  return (
    <BuildScreen
      summary={summary}
      findsWaysIn={isChange && summary?.code === true && summary.trigger === undefined}
      read={read}
      onStop={onStopBuild === undefined ? undefined : () => onStopBuild(name)}
      onBuildAgain={isChange ? onBuild : undefined}
      onBack={close}
    />
  )
}

// The settings screen, over the list.
export function Settings({ props, close }: { props: Props; close: () => void }) {
  return (
    <SettingsScreen
      settings={props.settings ?? {}}
      editors={props.editors ?? []}
      editor={props.editor}
      onChange={(key, value) => props.onChangeSetting?.(key, value)}
      onBack={close}
      tint={props.tint}
    />
  )
}
