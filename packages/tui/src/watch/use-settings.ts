import { type Settings, loadSettings, saveSetting } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { SettingChange } from "../settings/rows"

// Often enough that an agent's save shows up while the user waits for it.
const SETTINGS_POLL_MS = 2000

/**
 * The user's settings as they are now, and how to change one. The file can change while trek
 * runs (the agent saves its command from its chat, or the user edits it), so it's read again
 * every couple of seconds; a file broken meanwhile keeps what was read before. A changed setting
 * holds for every repo.
 */
export function useSettings(first: Settings): Readonly<{
  settings: Settings
  changeSetting: SettingChange
}> {
  const [settings, setSettings] = useState(first)

  useEffect(() => {
    const reread = async () => {
      const now = await loadSettings().catch(() => undefined)
      if (now !== undefined) {
        setSettings((shown) => (JSON.stringify(shown) === JSON.stringify(now) ? shown : now))
      }
    }
    const timer = setInterval(() => void reread(), SETTINGS_POLL_MS)

    return () => clearInterval(timer)
  }, [])

  const changeSetting: SettingChange = (key, value) => {
    setSettings({ ...settings, [key]: value })
    void saveSetting(key, value).catch(() => undefined)
  }

  return { settings, changeSetting }
}
