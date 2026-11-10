import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { z } from "zod"

/** What a user has chosen for srctrek: the editor treks open in, by its id. */
export type Settings = Readonly<{ editor?: string | undefined }>

const SettingsSchema = z.object({ editor: z.string().min(1).optional() })

/** Where a user's settings live: under $XDG_CONFIG_HOME, else ~/.config. */
export function settingsPath(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
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
export async function saveSetting(
  key: keyof Settings,
  value: string,
  path = settingsPath(),
): Promise<void> {
  const raw = await readRaw(path)
  if (raw[key] === value) {
    return
  }

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify({ ...raw, [key]: value }, null, 2) + "\n")
}
