import { type Settings, agentSetting } from "@srctrek/core"
import type { Editor } from "./editors"

/** Sets one of the user's settings, for every repo. */
export type SettingChange = <K extends keyof Settings>(
  key: K,
  value: NonNullable<Settings[K]>,
) => void

/**
 * A setting as the screen lists it: its value, where the value comes from, what it's for, what
 * enter does to it and says it does, and, for the agent, what c does.
 */
export type SettingRow = Readonly<{
  name: string
  value: string
  source: string
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
}>

const AGENT_SOURCES = {
  environment: "SRCTREK_AGENT",
  "settings file": "settings file",
  default: "not set",
}

function agentRow({ settings, typeAgent, copySetup }: RowActions): SettingRow {
  const { command, source, shadows } = agentSetting(settings)
  const from = shadows ? "SRCTREK_AGENT, over the settings file" : AGENT_SOURCES[source]

  return {
    name: "Agent",
    value: command ?? "none",
    source: from,
    help: "trek can have your coding agent build treks in the background, but it needs to know how to start your agent. Press c, paste what it copies into your agent's chat, and your agent fills this in.",
    change: typeAgent,
    enter: "type it",
    copy: copySetup,
  }
}

/** Each setting, in order, with its value, source, help, and keys. */
export function settingRows(actions: RowActions): SettingRow[] {
  const { settings, editor, onChange } = actions
  const building = settings.build_automatically === true
  const terminal = settings.colours === "terminal"
  const fileOrDefault = (key: keyof Settings) =>
    settings[key] === undefined ? "default" : "settings file"

  return [
    {
      name: "Editor",
      value: editor?.label ?? "not chosen",
      source: fileOrDefault("editor"),
      help: "Where enter opens a trek. Only editors found on this machine are offered.",
      change: actions.pickEditor,
      enter: "pick",
    },
    agentRow(actions),
    {
      name: "Build automatically",
      value: building ? "on" : "off",
      source: fileOrDefault("build_automatically"),
      help: "On, trek starts building a change's trek as it opens, when there's none and an agent is set. Off, it waits for b.",
      change: () => onChange("build_automatically", !building),
      enter: building ? "turn off" : "turn on",
    },
    {
      name: "Colours",
      value: terminal ? "the terminal's" : "srctrek's",
      source: fileOrDefault("colours"),
      help: "srctrek's keep states apart in any theme; the terminal's follow its own green, yellow, and red.",
      change: () => onChange("colours", terminal ? "srctrek" : "terminal"),
      enter: terminal ? "use srctrek's" : "use the terminal's",
    },
  ]
}

/** The footer for a row: what enter does to it, and c on the agent. */
export function rowKeys(row: SettingRow | undefined): string {
  const enter = row === undefined ? "" : ` · enter ${row.enter}`
  const copy = row?.copy === undefined ? "" : " · c copy for your agent"

  return `↑/↓ choose${enter}${copy} · esc back`
}
