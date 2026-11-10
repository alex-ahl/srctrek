import { type CliRenderer, TextAttributes } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { SETUP_REQUEST, type Settings, agentSetting, checkAgent, settingsPath } from "@srctrek/core"
import { homedir } from "node:os"
import { useEffect, useRef, useState } from "react"
import { EditorPicker } from "./editor-picker"
import type { Editor } from "./editors"
import { PADDING } from "./layout"
import { type Notice, NoticeLine } from "./settings-notice"
import { type SettingChange, type SettingRow, rowKeys, settingRows } from "./settings-rows"
import { TextPrompt } from "./text-prompt"
import { fit, wrap } from "./text"
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
const NOTE_GAP = 2

// A value too long for the line, beside its name and any note, is cut with "…"; enter on the
// agent still shows the whole command.
function RowView({
  row,
  selected,
  lineWidth,
}: {
  row: SettingRow
  selected: boolean
  lineWidth: number
}) {
  const tones = useTones()
  const noteWidth = row.note === undefined ? 0 : NOTE_GAP + row.note.length
  const room = lineWidth - 2 - NAME_WIDTH - noteWidth

  return (
    <text fg={COLOUR.text}>
      <span fg={tones.accent}>{selected ? "▶ " : "  "}</span>
      <span>{row.name.padEnd(NAME_WIDTH)}</span>
      <span attributes={TextAttributes.BOLD}>{fit(row.value, room)}</span>
      {row.note !== undefined && <span fg={tones.dim}>{`  ${row.note}`}</span>}
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

// The settings file in the title bar: home as ~, and a path too long for the bar cut from its
// start, so the end, which says which file, stays.
function shownPath(width: number): string {
  const path = settingsPath().replace(homedir(), "~")
  const room = width - 2 * PADDING - "srctrek".length - SUBTITLE.length - 2

  return path.length <= room ? path : `…${path.slice(path.length - room + 1)}`
}

const REQUEST_LEAD = "  Press c to copy this, then paste it into your agent's chat:"

// The request c copies, quoted under the agent's help: a bar in the accent beside text in the
// text colour, so what to paste stands apart from the grey help around it.
function SetupRequest({ width }: { width: number }) {
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ marginTop: 1 }}>
      <text fg={tones.dim}>{REQUEST_LEAD}</text>
      {wrap(SETUP_REQUEST, width - 2).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          <span fg={tones.accent}>{"  ▌ "}</span>
          {line}
        </text>
      ))}
    </box>
  )
}

// The request shows on the agent while there's no command yet, and right after c; once the agent
// has saved its command, it's done its job.
function showsRequest(row: SettingRow | undefined, settings: Settings, notice: Notice | undefined) {
  if (row?.copy === undefined || notice?.kind === "saved-by-agent") {
    return false
  }

  const justCopied = notice?.kind === "copied" || notice?.kind === "uncopied"
  return justCopied || agentSetting(settings).command === undefined
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
  const helpWidth = Math.min(HELP_WIDTH, width - 2 * PADDING - 2)

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
        <text fg={tones.dim}>{shownPath(width)}</text>
      </box>
      <box
        flexDirection="column"
        style={{ flexGrow: 1, paddingTop: 1, paddingLeft: PADDING, paddingRight: PADDING }}
      >
        {rows.map((each, i) => (
          <RowView
            key={each.name}
            row={each}
            selected={i === chosen}
            lineWidth={width - 2 * PADDING}
          />
        ))}
        <text fg={COLOUR.text}> </text>
        {wrap(row?.help ?? "", helpWidth).map((line, i) => (
          <text key={i} fg={tones.dim}>{`  ${line}`}</text>
        ))}
        {showsRequest(row, props.settings, notice) && <SetupRequest width={helpWidth} />}
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
