import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { z } from "zod"

const SettingsSchema = z.object({
  // where enter steps a trek: "terminal", or an editor by its id
  step_in: z.string().min(1).optional(),
  // the command that runs the user's agent headless
  agent: z.string().min(1).optional(),
  // whether trek starts building a change's trek as it opens, when there's none
  build_automatically: z.boolean().optional(),
  // whose colours the states take: srctrek's, or the terminal's own
  colours: z.enum(["srctrek", "terminal"]).optional(),
})

/** What a user has chosen for srctrek; unset keys take their defaults. */
export type Settings = Readonly<z.infer<typeof SettingsSchema>>

/** Where a setting's value comes from. */
export type SettingSource = "environment" | "settings file" | "default"

type Env = Readonly<Record<string, string | undefined>>

/**
 * The agent's command in effect and where it comes from: SRCTREK_AGENT overrides the settings
 * file, for scripts and CI; `shadows` says the file holds one it overrides.
 */
export function agentSetting(
  settings: Settings,
  env: Env = process.env,
): Readonly<{ command: string | undefined; source: SettingSource; shadows: boolean }> {
  const fromEnv = env["SRCTREK_AGENT"]?.trim()
  if (fromEnv !== undefined && fromEnv !== "") {
    return { command: fromEnv, source: "environment", shadows: settings.agent !== undefined }
  }

  const source = settings.agent === undefined ? "default" : "settings file"
  return { command: settings.agent, source, shadows: false }
}

/** Where a user's settings live: under $XDG_CONFIG_HOME, else ~/.config. */
export function settingsPath(env: Env = process.env): string {
  const config = env["XDG_CONFIG_HOME"]?.trim() || join(homedir(), ".config")

  return join(config, "srctrek", "settings.json")
}

// The settings file's text as an object, every key kept.
function parseObject(text: string, path: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${path} isn't valid JSON`, { cause: error })
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} isn't a JSON object`)
  }

  return { ...parsed }
}

// The file as it stands, or nothing set when it isn't there yet.
async function readRaw(path: string): Promise<Record<string, unknown>> {
  const text = await readFile(path, "utf8").catch(() => undefined)

  return text === undefined ? {} : parseObject(text, path)
}

/** The user's settings; none set when the file isn't there. */
export async function loadSettings(path = settingsPath()): Promise<Settings> {
  const parsed = SettingsSchema.safeParse(await readRaw(path))
  if (!parsed.success) {
    throw new Error(`${path} isn't valid settings: ${parsed.error.issues[0]?.message ?? "invalid"}`)
  }

  return parsed.data
}

/**
 * Sets one setting, keeping every other key as it was, in the order it was; writes nothing when
 * the value is already set. Written in place, not replaced, so a linked file stays linked.
 */
export async function saveSetting<K extends keyof Settings>(
  key: K,
  value: NonNullable<Settings[K]>,
  path = settingsPath(),
): Promise<void> {
  const raw = await readRaw(path)
  if (raw[key] === value) {
    return
  }

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify({ ...raw, [key]: value }, null, 2) + "\n")
}
