import { type CliRenderer, TextAttributes } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { SETUP_REQUEST, type Settings, agentSetting, checkAgent, settingsPath } from "@srctrek/core"
import { useEffect, useRef, useState } from "react"
import { EditorPicker } from "./editor-picker"
import type { Editor } from "./editors"
import { PADDING } from "./layout"
import { type Notice, NoticeLine } from "./settings-notice"
import { type SettingChange, type SettingRow, rowKeys, settingRows } from "./settings-rows"
import { TextPrompt } from "./text-prompt"
import { wrap } from "./text"
import { COLOUR, useTones } from "./theme"

export type { SettingChange } from "./settings-rows"

type Props = {
  settings: Settings
  // the editors treks can open in here, and the one chosen
  editors: readonly Editor[]
  editor: Editor | undefined
  onChange: SettingChange
  onBack: () => void
}

// What the bottom of the screen is asking: which editor, or the agent's command.
type Prompt = "editor" | "agent"

// After srctrek in the title bar, as the change is on the home screen.
const SUBTITLE = "  settings"
// Help reads as a short paragraph, not one line across a wide terminal.
const HELP_WIDTH = 76
const NAME_WIDTH = 24
const VALUE_WIDTH = 34

function RowView({ row, selected }: { row: SettingRow; selected: boolean }) {
  const tones = useTones()

  return (
    <text fg={COLOUR.text}>
      <span fg={tones.accent}>{selected ? "▶ " : "  "}</span>
      <span>{row.name.padEnd(NAME_WIDTH)}</span>
      <span attributes={TextAttributes.BOLD}>{row.value.padEnd(VALUE_WIDTH)}</span>
      <span fg={tones.dim}>{row.source}</span>
    </text>
  )
}

const AGENT_HINT =
  "the command that runs your agent without a chat; trek adds a trek's instructions as its last argument"

// The bottom of the screen: the prompt that's open, else the keys.
function Bottom({
  prompt,
  props,
  keys,
  close,
  onAgent,
}: {
  prompt: Prompt | undefined
  props: Props
  keys: string
  close: () => void
  onAgent: (command: string) => void
}) {
  const tones = useTones()
  if (prompt === "editor") {
    const pick = (picked: Editor) => {
      close()
      props.onChange("editor", picked.id)
    }
    return (
      <EditorPicker editors={props.editors} current={props.editor} onPick={pick} onCancel={close} />
    )
  }

  if (prompt === "agent") {
    const { source } = agentSetting(props.settings)
    const overridden =
      source === "environment" ? " · SRCTREK_AGENT overrides this while it's set" : ""
    return (
      <TextPrompt
        question="Agent command:"
        initial={props.settings.agent}
        hint={`${AGENT_HINT}${overridden}`}
        onSubmit={onAgent}
        onCancel={close}
      />
    )
  }

  return (
    <box
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={tones.dim}>{keys}</text>
    </box>
  )
}

/**
 * Tells when the agent saves its command from its chat: the saved command arrives in `agent`, and
 * differs from both what was there and what was typed here.
 */
function useSavedByAgent(agent: string | undefined, notify: (notice: Notice) => void) {
  const before = useRef(agent)
  const typedHere = useRef<string | undefined>(undefined)

  useEffect(() => {
    const fromAgent = agent !== undefined && agent !== before.current && agent !== typedHere.current
    before.current = agent
    if (fromAgent) {
      notify({ kind: "saved-by-agent" })
    }
  }, [agent, notify])

  return (command: string) => {
    typedHere.current = command
  }
}

// Whether the setup request reached the clipboard: the terminal may not take it, and the renderer
// can refuse outright, which shows the request to copy by hand either way.
function copied(renderer: CliRenderer): boolean {
  try {
    return renderer.copyToClipboardOSC52(SETUP_REQUEST)
  } catch {
    return false
  }
}

/** The user's settings, each with its value and where it comes from; enter changes one. */
export function SettingsScreen(props: Props) {
  const tones = useTones()
  const { width } = useTerminalDimensions()
  const renderer = useRenderer()
  const [prompt, setPrompt] = useState<Prompt | undefined>(undefined)
  const [notice, setNotice] = useState<Notice | undefined>(undefined)
  const [chosen, setChosen] = useState(0)
  const noteTyped = useSavedByAgent(props.settings.agent, setNotice)

  const rows = settingRows({
    settings: props.settings,
    editor: props.editor,
    onChange: props.onChange,
    pickEditor: () => setPrompt("editor"),
    typeAgent: () => setPrompt("agent"),
    copySetup: () => setNotice({ kind: copied(renderer) ? "copied" : "uncopied" }),
  })
  const row = rows[chosen]

  const saveAgent = (command: string) => {
    setPrompt(undefined)
    noteTyped(command)
    props.onChange("agent", command)
    setNotice({ kind: "checking" })
    void checkAgent(command).then((check) => setNotice({ kind: "checked", check }))
  }

  const down = () => setChosen(Math.min(chosen + 1, rows.length - 1))
  const up = () => setChosen(Math.max(chosen - 1, 0))
  const keyActions = new Map([
    ["escape", props.onBack],
    ["return", () => row?.change()],
    ["c", () => row?.copy?.()],
    ["down", down],
    ["j", down],
    ["up", up],
    ["k", up],
  ])
  // While a prompt is open, keys go to it.
  useKeyboard((key) => prompt === undefined && keyActions.get(key.name)?.())

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <box
        flexDirection="row"
        justifyContent="space-between"
        border={["bottom"]}
        borderColor={tones.dim}
        style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
      >
        <text fg={COLOUR.text}>
          <span attributes={TextAttributes.BOLD}>srctrek</span>
          <span fg={tones.dim}>{SUBTITLE}</span>
        </text>
        <text fg={tones.dim}>{settingsPath()}</text>
      </box>
      <box
        flexDirection="column"
        style={{ flexGrow: 1, paddingTop: 1, paddingLeft: PADDING, paddingRight: PADDING }}
      >
        {rows.map((each, i) => (
          <RowView key={each.name} row={each} selected={i === chosen} />
        ))}
        <text fg={COLOUR.text}> </text>
        {wrap(row?.help ?? "", Math.min(HELP_WIDTH, width - 2 * PADDING - 2)).map((line, i) => (
          <text key={i} fg={tones.dim}>{`  ${line}`}</text>
        ))}
        {notice !== undefined && <NoticeLine notice={notice} />}
      </box>
      <Bottom
        prompt={prompt}
        props={props}
        keys={rowKeys(row)}
        close={() => setPrompt(undefined)}
        onAgent={saveAgent}
      />
    </box>
  )
}
