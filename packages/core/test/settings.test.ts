import { describe, expect, test } from "bun:test"
import { lstat, readFile, stat, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { agentSetting, loadSettings, saveSetting, settingsPath } from "../src"
import { rejection } from "./support/rejection"
import { tempDir } from "@srctrek/testing"

describe("settings", () => {
  test("live under XDG_CONFIG_HOME, else ~/.config", () => {
    expect(settingsPath({ XDG_CONFIG_HOME: "/x" })).toBe("/x/srctrek/settings.json")
    expect(settingsPath({})).toEndWith("/.config/srctrek/settings.json")
  })

  test("are none until saved, then hold what was saved", async () => {
    const path = join(await tempDir("settings-"), "srctrek", "settings.json")
    expect(await loadSettings(path)).toEqual({})

    await saveSetting("step_in", "nvim", path)
    expect(await loadSettings(path)).toEqual({ step_in: "nvim" })
    expect(await readFile(path, "utf8")).toBe('{\n  "step_in": "nvim"\n}\n')
  })

  test("keep keys they don't know, in their order", async () => {
    const path = join(await tempDir("settings-"), "settings.json")
    await writeFile(path, '{ "theme": "mine", "step_in": "nvim", "later": 1 }\n')

    await saveSetting("step_in", "$EDITOR", path)
    expect(await readFile(path, "utf8")).toBe(
      '{\n  "theme": "mine",\n  "step_in": "$EDITOR",\n  "later": 1\n}\n',
    )
  })

  test("aren't written again when nothing changes", async () => {
    const path = join(await tempDir("settings-"), "settings.json")
    await writeFile(path, '{"step_in":"nvim"}')

    await saveSetting("step_in", "nvim", path)
    expect(await readFile(path, "utf8")).toBe('{"step_in":"nvim"}')
  })

  test("are written through a link, which stays a link", async () => {
    const dir = await tempDir("settings-")
    const target = join(dir, "kept.json")
    const link = join(dir, "settings.json")
    await writeFile(target, "{}")
    await symlink(target, link)

    await saveSetting("step_in", "nvim", link)
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual({ step_in: "nvim" })
    expect((await stat(link)).isFile()).toBe(true)
  })

  test("say which file is wrong when it isn't valid JSON, and leave it alone", async () => {
    const path = join(await tempDir("settings-"), "settings.json")
    await writeFile(path, "{ step_in: nvim")

    expect(await rejection(loadSettings(path))).toMatchObject({
      message: `${path} isn't valid JSON`,
    })
    expect(await rejection(saveSetting("step_in", "nvim", path))).toBeInstanceOf(Error)
    expect(await readFile(path, "utf8")).toBe("{ step_in: nvim")
  })
})

describe("agentSetting", () => {
  test("takes SRCTREK_AGENT over the settings file, and says it shadows one", () => {
    expect(agentSetting({ agent: "from-file" }, { SRCTREK_AGENT: "from-env" })).toEqual({
      command: "from-env",
      source: "environment",
      shadows: true,
    })
  })

  test("takes the settings file when SRCTREK_AGENT is unset or blank", () => {
    expect(agentSetting({ agent: "from-file" }, { SRCTREK_AGENT: " " })).toEqual({
      command: "from-file",
      source: "settings file",
      shadows: false,
    })
  })

  test("is none by default", () => {
    expect(agentSetting({}, {})).toEqual({ command: undefined, source: "default", shadows: false })
  })
})
