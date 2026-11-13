import type { KeyHint } from "../ui/footer"
import { type Settings, agentSetting } from "@srctrek/core"
import type { Editor } from "../editors/editors"
import type { Tone } from "../ui/theme"

/** Sets one of the user's settings, for every repo. */
export type SettingChange = <K extends keyof Settings>(
  key: K,
  value: NonNullable<Settings[K]>,
) => void

/** The headings settings are grouped under, in the order they're listed. */
export type SettingGroup = "OPENING" | "BUILDING" | "LOOK"

/**
 * A setting as the screen lists it, under its group: its value (in a tone where the tone says
 * what it means, else bold), a mark after it, a note when the environment sets it, a sample of
 * the states' colours for the colours, what it's for, what enter does to it and says it does, and,
 * for the agent, what c does.
 */
export type SettingRow = Readonly<{
  group: SettingGroup
  name: string
  value: string
  tone?: Tone
  mark?: Readonly<{ symbol: string; tone: Tone }>
  note?: string
  sample?: true
  help: string
  change: () => void
  enter: string
  copy?: () => void
}>

/** What the rows act through: the settings, the change, and the screen's own prompts. */
export type RowActions = Readonly<{
  settings: Settings
  editor: Editor | undefined
  onChange: SettingChange
  pickEditor: () => void
  typeAgent: () => void
  copySetup: () => void
  // whether the agent's command passed its check, once checked on this visit
  agentWorks: boolean | undefined
}>

const checkMark = (works: boolean) =>
  works ? { symbol: "✓", tone: "good" as const } : { symbol: "✕", tone: "bad" as const }

function agentRow({ settings, typeAgent, copySetup, agentWorks }: RowActions): SettingRow {
  const { command, source, shadows } = agentSetting(settings)
  const fromEnvironment = shadows
    ? "SRCTREK_AGENT overrides the settings file"
    : "from SRCTREK_AGENT"

  return {
    group: "BUILDING",
    name: "Agent",
    value: command ?? "none",
    ...(command === undefined && { tone: "dim" as const }),
    ...(command !== undefined && agentWorks !== undefined && { mark: checkMark(agentWorks) }),
    ...(source === "environment" && { note: fromEnvironment }),
    help: "trek can have your coding agent build treks in the background, but it needs to know how to start your agent.",
    change: typeAgent,
    enter: "type it",
    copy: copySetup,
  }
}

/** Each setting, in order, with its value, help, and keys. */
export function settingRows(actions: RowActions): SettingRow[] {
  const { settings, editor, onChange } = actions
  const building = settings.build_automatically === true
  const terminal = settings.colours === "terminal"

  return [
    {
      group: "OPENING",
      name: "Editor",
      value: editor?.label ?? "not chosen",
      ...(editor === undefined && { tone: "dim" as const }),
      help: "Where enter opens a trek. Only editors found on this machine are offered.",
      change: actions.pickEditor,
      enter: "pick",
    },
    agentRow(actions),
    {
      group: "BUILDING",
      name: "Build automatically",
      value: building ? "● on" : "○ off",
      tone: building ? "good" : "dim",
      help: "On, trek starts building a change's trek as it opens, when there's none and an agent is set. Off, it waits for b.",
      change: () => onChange("build_automatically", !building),
      enter: building ? "turn off" : "turn on",
    },
    {
      group: "LOOK",
      name: "Colours",
      value: terminal ? "the terminal's" : "srctrek's",
      sample: true,
      help: "srctrek's keep states apart in any theme; the terminal's follow its own green, yellow, and red.",
      change: () => onChange("colours", terminal ? "srctrek" : "terminal"),
      enter: terminal ? "use srctrek's" : "use the terminal's",
    },
  ]
}

/** The footer for a row: what enter does to it, and c on the agent. */
export function rowKeys(row: SettingRow | undefined): KeyHint[] {
  return [
    { key: "↑/↓", does: "choose" },
    ...(row === undefined ? [] : [{ key: "enter", does: row.enter }]),
    ...(row?.copy === undefined ? [] : [{ key: "c", does: "copy for your agent" }]),
    { key: "esc", does: "back" },
  ]
}
