import { expect, mock, test } from "bun:test"
import { SETUP_REQUEST, type Settings, type TrekEntry } from "@srctrek/core"
import { useEffect, useState } from "react"
import { App } from "../src/app"
import type { Editor } from "../src/editors"
import type { SettingChange } from "../src/settings-screen"
import { frameAfter, pressOn } from "./support/keys"

const noop = () => undefined
const neovim: Editor = { id: "nvim", label: "Neovim", command: "nvim", steps: true }
const entries: TrekEntry[] = []

function app(settings: Settings, onChangeSetting: SettingChange = noop) {
  return (
    <App
      entries={entries}
      onOpen={noop}
      onQuit={noop}
      editors={[neovim]}
      editor={neovim}
      settings={settings}
      onChangeSetting={onChangeSetting}
    />
  )
}

test("S opens settings: each setting with its value and where it comes from", async () => {
  const frame = await frameAfter(app({ editor: "nvim", colours: "terminal" }), (input) =>
    input.pressKey("S", { shift: true }),
  )

  expect(frame).toContain("  srctrek  settings")
  expect(frame).toContain("▶ Editor                  Neovim")
  expect(frame).toMatch(/Editor +Neovim +settings file/)
  expect(frame).toMatch(/Build automatically +off +default/)
  expect(frame).toMatch(/Colours +the terminal's +settings file/)
  expect(frame).toContain("Where enter opens a trek.")
})

test("enter on building automatically or colours turns it the other way", async () => {
  const change = mock<SettingChange>(() => undefined)
  await pressOn(app({}, change), async (input) => {
    for (const press of ["S", "j", "j", "return", "j", "return"]) {
      if (press === "S") {
        input.pressKey("S", { shift: true })
      } else if (press === "return") {
        input.pressEnter()
      } else {
        input.pressKey(press)
      }
      // each key lands on the screen the one before it left
      await Bun.sleep(20)
    }
  })

  expect(change).toHaveBeenCalledWith("build_automatically", true)
  expect(change).toHaveBeenCalledWith("colours", "terminal")
})

test("esc goes back to the list", async () => {
  const frame = await frameAfter(app({}), async (input) => {
    input.pressKey("S", { shift: true })
    await Bun.sleep(20)
    input.pressEscape()
    await Bun.sleep(50)
  })

  expect(frame).not.toContain("srctrek  settings")
  expect(frame).toContain("No treks in .srctrek/treks yet.")
})

test("enter on the agent asks for its command, saves it, and says whether it works", async () => {
  const change = mock<SettingChange>(() => undefined)
  const frame = await frameAfter(app({}, change), async (input) => {
    input.pressKey("S", { shift: true })
    await Bun.sleep(20)
    input.pressKey("j")
    await Bun.sleep(20)
    input.pressEnter()
    await Bun.sleep(20)
    await input.typeText("true")
    input.pressEnter()
    // the check runs the command, which takes a moment even for true
    await Bun.sleep(300)
  })

  expect(change).toHaveBeenCalledWith("agent", "true")
  expect(frame).toContain("✓ the command starts and answers")
})

test("the agent's prompt says what to type", async () => {
  const frame = await frameAfter(app({}), async (input) => {
    input.pressKey("S", { shift: true })
    await Bun.sleep(20)
    input.pressKey("j")
    await Bun.sleep(20)
    input.pressEnter()
    await Bun.sleep(20)
  })

  expect(frame).toContain("Agent command:")
  expect(frame).toContain("the command that runs your agent without a chat")
})

test("c on the agent copies what to paste into the agent's chat, or shows it when it can't", async () => {
  const frame = await frameAfter(app({}), async (input) => {
    input.pressKey("S", { shift: true })
    await Bun.sleep(20)
    input.pressKey("j")
    await Bun.sleep(20)
    input.pressKey("c")
    await Bun.sleep(20)
  })

  expect(frame).toContain("c copy for your agent")
  const copied = frame.includes("✓ copied: paste it into your agent's chat")
  const shown = frame.includes(SETUP_REQUEST)
  expect(copied || shown).toBe(true)
})

test("says when the agent saved its command from its chat", async () => {
  // The settings as the home screen rereads them: the agent's command arrives after a moment.
  function Later() {
    const [settings, setSettings] = useState<Settings>({})
    useEffect(() => {
      const timer = setTimeout(() => setSettings({ agent: "agent run --headless" }), 60)
      return () => clearTimeout(timer)
    }, [])

    return app(settings)
  }

  const frame = await frameAfter(<Later />, async (input) => {
    input.pressKey("S", { shift: true })
    await Bun.sleep(150)
  })

  expect(frame).toMatch(/Agent +agent run --headless +settings file/)
  expect(frame).toContain("✓ your agent saved its command; it starts and answers")
})
