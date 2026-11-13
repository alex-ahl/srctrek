import { type CliRenderer, type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { SETUP_REQUEST, type Settings, agentSetting, checkAgent, settingsPath } from "@srctrek/core"
import { homedir } from "node:os"
import { useEffect, useRef, useState } from "react"
import { EditorPicker } from "../editors/editor-picker"
import type { Editor } from "../editors/editors"
import { PADDING } from "../ui/layout"
import { SettingsList } from "./list"
import { type Notice, NoticeLine } from "./notice"
import { type SettingChange, type SettingRow, rowKeys, settingRows } from "./rows"
import { TextPrompt } from "../ui/text-prompt"
import { TitleBar, titleRoom } from "../ui/title-bar"
import { wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

type Props = {
  settings: Settings
  // the editors treks can open in here, and the one chosen
  editors: readonly Editor[]
  editor: Editor | undefined
  onChange: SettingChange
  onBack: () => void
  // the chosen row's background, when the terminal's colours are known
  tint: RGBA | undefined
}

// What the bottom of the screen is asking: which editor, or the agent's command.
type Prompt = "editor" | "agent"

// After srctrek in the title bar, as the change is on the home screen.
const SUBTITLE = "settings"
// Help reads as a short paragraph, not one line across a wide terminal.
const HELP_WIDTH = 76
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
      <EditorPicker
        editors={props.editors}
        current={props.editor}
        onPick={pick}
        onCancel={close}
        tint={props.tint}
      />
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
  const room = titleRoom(width) - SUBTITLE.length - 2

  return path.length <= room ? path : `…${path.slice(path.length - room + 1)}`
}

const REQUEST_LEAD = "Press c to copy this, then paste it into your agent's chat:"

// The request c copies, quoted under the agent's help: a bar in the accent beside text in the
// text colour, so what to paste stands apart from the grey help around it.
function SetupRequest({ width }: { width: number }) {
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ marginTop: 1 }}>
      <text fg={tones.dim}>{REQUEST_LEAD}</text>
      {wrap(SETUP_REQUEST, width - 2).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          <span fg={tones.accent}>{"▌ "}</span>
          {line}
        </text>
      ))}
    </box>
  )
}

// The agent's check this visit, typed here or saved by the agent, marks its command.
function agentWorks(notice: Notice | undefined): boolean | undefined {
  if (notice?.kind === "checked") {
    return notice.check.ok
  }

  return notice?.kind === "saved-by-agent" ? true : undefined
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

// What the chosen setting is for, under its name, in a panel above the footer.
function Help({ row, width }: { row: SettingRow | undefined; width: number }) {
  const tones = useTones()

  return (
    <box flexDirection="column">
      <text fg={COLOUR.text} attributes={TextAttributes.BOLD}>
        {row?.name ?? ""}
      </text>
      {wrap(row?.help ?? "", width).map((line, i) => (
        <text key={i} fg={tones.dim}>
          {line}
        </text>
      ))}
    </box>
  )
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
    agentWorks: agentWorks(notice),
  })
  const row = rows[chosen]
  const lineWidth = width - 2 * PADDING
  const helpWidth = Math.min(HELP_WIDTH, lineWidth)

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
      <TitleBar left={<span fg={tones.dim}>{SUBTITLE}</span>} right={shownPath(width)} />
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
        <SettingsList rows={rows} chosen={chosen} lineWidth={lineWidth} tint={props.tint} />
      </box>
      <box
        flexDirection="column"
        border={["top"]}
        borderColor={tones.dim}
        style={{ flexShrink: 0, paddingLeft: PADDING, paddingRight: PADDING }}
      >
        <Help row={row} width={helpWidth} />
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
