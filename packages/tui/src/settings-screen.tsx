import { TextAttributes } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import {
  type AgentCheck,
  type Settings,
  agentSetting,
  checkAgent,
  settingsPath,
} from "@srctrek/core"
import { useState } from "react"
import { EditorPicker } from "./editor-picker"
import type { Editor } from "./editors"
import { PADDING } from "./layout"
import { TextPrompt } from "./text-prompt"
import { wrap } from "./text"
import { COLOUR, useTones } from "./theme"

/** Sets one of the user's settings, for every repo. */
export type SettingChange = <K extends keyof Settings>(
  key: K,
  value: NonNullable<Settings[K]>,
) => void

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

// Where checking the agent's command stands, once one is saved.
type Checking = "checking" | AgentCheck

// A setting as the screen lists it: its value, where the value comes from, what it's for, and
// what enter does to it, if anything yet.
type Row = Readonly<{
  name: string
  value: string
  source: string
  help: string
  change?: () => void
}>

function agentRow(settings: Settings, ask: () => void): Row {
  const { command, source, shadows } = agentSetting(settings)
  const from = {
    environment: shadows ? "SRCTREK_AGENT, over the settings file" : "SRCTREK_AGENT",
    "settings file": "settings file",
    default: "not set",
  }[source]

  return {
    name: "Agent",
    value: command ?? "none",
    source: from,
    help: "The command that runs your agent headless, with a trek's instructions as its last argument. trek starts it to build a trek.",
    change: ask,
  }
}

// What each setting shows, and what enter does to it.
function rowsOf({ settings, editor, onChange }: Props, open: (prompt: Prompt) => void): Row[] {
  const building = settings.build_automatically === true
  const terminal = settings.colours === "terminal"
  const fileOrDefault = (key: keyof Settings) =>
    settings[key] === undefined ? "default" : "settings file"

  return [
    {
      name: "Editor",
      value: editor?.label ?? "not chosen",
      source: settings.editor === undefined ? "default" : "settings file",
      help: "Where enter opens a trek. Only editors found on this machine are offered.",
      change: () => open("editor"),
    },
    agentRow(settings, () => open("agent")),
    {
      name: "Build automatically",
      value: building ? "on" : "off",
      source: fileOrDefault("build_automatically"),
      help: "On, trek starts building a change's trek as it opens, when there's none and an agent is set. Off, it waits for b.",
      change: () => onChange("build_automatically", !building),
    },
    {
      name: "Colours",
      value: terminal ? "the terminal's" : "srctrek's",
      source: fileOrDefault("colours"),
      help: "srctrek's keep states apart in any theme; the terminal's follow its own green, yellow, and red.",
      change: () => onChange("colours", terminal ? "srctrek" : "terminal"),
    },
  ]
}

// After srctrek in the title bar, as the change is on the home screen.
const SUBTITLE = "  settings"
const NAME_WIDTH = 24
const VALUE_WIDTH = 34

function RowView({ row, selected }: { row: Row; selected: boolean }) {
  const tones = useTones()

  return (
    <text fg={COLOUR.text}>
      <span fg={tones.accent}>{selected ? "▶ " : "  "}</span>
      <span>{row.name.padEnd(NAME_WIDTH)}</span>
      <span attributes={TextAttributes.BOLD}>{row.value.padEnd(VALUE_WIDTH)}</span>
      <span fg={COLOUR.dim}>{row.source}</span>
    </text>
  )
}

const CHECKING = "  checking that the command starts and answers…"
const WORKS = "  ✓ the command starts and answers"

// What checking the agent's command found: still checking, it works, or why it doesn't.
function CheckLine({ checking }: { checking: Checking }) {
  const tones = useTones()
  if (checking === "checking") {
    return <text fg={COLOUR.dim}>{CHECKING}</text>
  }

  if (checking.ok) {
    return <text fg={tones.good}>{WORKS}</text>
  }

  return <text fg={tones.bad}>{`  ✕ ${checking.problem}`}</text>
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
      borderColor={COLOUR.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={COLOUR.dim}>{keys}</text>
    </box>
  )
}

/** The user's settings, each with its value and where it comes from; enter changes one. */
export function SettingsScreen(props: Props) {
  const { width } = useTerminalDimensions()
  const [prompt, setPrompt] = useState<Prompt | undefined>(undefined)
  const [checking, setChecking] = useState<Checking | undefined>(undefined)
  const rows = rowsOf(props, setPrompt)
  const [chosen, setChosen] = useState(0)
  const row = rows[chosen]

  // While a prompt is open, keys go to it.
  useKeyboard((key) => {
    if (prompt !== undefined) {
      return
    }

    if (key.name === "escape") {
      props.onBack()
    } else if (key.name === "return") {
      row?.change?.()
    } else if (key.name === "down" || key.name === "j") {
      setChosen(Math.min(chosen + 1, rows.length - 1))
    } else if (key.name === "up" || key.name === "k") {
      setChosen(Math.max(chosen - 1, 0))
    }
  })

  const keys =
    row?.change === undefined ? "↑/↓ choose · esc back" : "↑/↓ choose · enter change · esc back"

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <box
        flexDirection="row"
        justifyContent="space-between"
        border={["bottom"]}
        borderColor={COLOUR.dim}
        style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
      >
        <text fg={COLOUR.text}>
          <span attributes={TextAttributes.BOLD}>srctrek</span>
          <span fg={COLOUR.dim}>{SUBTITLE}</span>
        </text>
        <text fg={COLOUR.dim}>{settingsPath()}</text>
      </box>
      <box
        flexDirection="column"
        style={{ flexGrow: 1, paddingTop: 1, paddingLeft: PADDING, paddingRight: PADDING }}
      >
        {rows.map((each, i) => (
          <RowView key={each.name} row={each} selected={i === chosen} />
        ))}
        <text fg={COLOUR.text}> </text>
        {wrap(row?.help ?? "", width - 2 * PADDING - 2).map((line, i) => (
          <text key={i} fg={COLOUR.dim}>{`  ${line}`}</text>
        ))}
        {checking !== undefined && <CheckLine checking={checking} />}
      </box>
      <Bottom
        prompt={prompt}
        props={props}
        keys={keys}
        close={() => setPrompt(undefined)}
        onAgent={(command) => {
          setPrompt(undefined)
          props.onChange("agent", command)
          setChecking("checking")
          void checkAgent(command).then(setChecking)
        }}
      />
    </box>
  )
}
