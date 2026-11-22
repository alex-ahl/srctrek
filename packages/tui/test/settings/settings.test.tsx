import { expect, mock, test } from "bun:test"
import type { Settings } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { Editor } from "../../src/editors/editors"
import { SettingsScreen } from "../../src/settings/screen"
import type { SettingChange } from "../../src/settings/rows"
import { frameAfter, pressOn } from "../support/keys"

const noop = () => undefined
const neovim: Editor = { id: "nvim", label: "Neovim", command: "nvim", steps: true }
// The settings screen, opened: S on the screens that open it does nothing here.
function app(settings: Settings, onChange: SettingChange = noop, onBack: () => void = noop) {
  return (
    <SettingsScreen
      settings={settings}
      editors={[neovim]}
      editor={neovim}
      onChange={onChange}
      onBack={onBack}
      tint={undefined}
    />
  )
}

test("S opens settings: each setting with its value and where it comes from", async () => {
  const frame = await frameAfter(app({ step_in: "nvim", colours: "terminal" }), (input) =>
    input.pressKey("S", { shift: true }),
  )

  expect(frame).toContain("  srctrek › settings")
  expect(frame).toContain("▶ Step in                 Neovim")
  expect(frame).toMatch(/Build automatically +○ off/)
  expect(frame).toMatch(/Colours +the terminal's/)
  expect(frame).not.toContain("settings file")
  expect(frame).toContain("Where enter steps a trek: here, or in an editor found on this machine.")
})

const LONG_AGENT = 'AGENT_HOME=~/.agent-one agent --allowed-tools "mcp__srctrek__*" -p'

test("a long value is cut to the line, keeping any note beside it", async () => {
  const openSettings = (input: { pressKey: (key: string, mods?: { shift: boolean }) => void }) =>
    input.pressKey("S", { shift: true })
  const wide = await frameAfter(app({ agent: LONG_AGENT }), openSettings, 140)
  const narrow = await frameAfter(app({ agent: LONG_AGENT }), openSettings, 70)

  expect(wide).toContain(`Agent                   ${LONG_AGENT}`)
  expect(narrow).toMatch(/Agent +AGENT_HOME=\S+.*…/)
})

test("says beside the agent when SRCTREK_AGENT sets it", async () => {
  process.env.SRCTREK_AGENT = "agent from env"
  try {
    const frame = await frameAfter(app({ agent: "agent from file" }), (input) =>
      input.pressKey("S", { shift: true }),
    )
    expect(frame).toContain("agent from env  SRCTREK_AGENT overrides the settings file")
  } finally {
    delete process.env.SRCTREK_AGENT
  }
})

test("keys pressed faster than the screen redraws each move the selection", async () => {
  const frame = await frameAfter(app({ step_in: "nvim" }), async (input) => {
    input.pressKey("S", { shift: true })
    await Bun.sleep(20)
    input.pressKey("j")
    input.pressKey("j")
    input.pressKey("j")
    await Bun.sleep(20)
  })

  expect(frame).toMatch(/▶ Colours/)
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

test("esc goes back", async () => {
  const back = mock(noop)
  await frameAfter(app({}, noop, back), async (input) => {
    input.pressEscape()
    // escape reaches the screen only once the terminal's wait for a longer sequence is over
    while (back.mock.calls.length === 0) {
      await Bun.sleep(10)
    }
  })

  expect(back).toHaveBeenCalled()
})

test("enter on the agent asks for its command, saves it, and says whether it works", async () => {
  const change = mock<SettingChange>(() => undefined)
  const frame = await frameAfter(
    app({}, change),
    async (input) => {
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
    },
    110,
    32,
  )

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

test("y on the agent copies what to paste into the agent's chat, or shows it when it can't", async () => {
  const frame = await frameAfter(
    app({}),
    async (input) => {
      input.pressKey("S", { shift: true })
      await Bun.sleep(20)
      input.pressKey("j")
      await Bun.sleep(20)
      input.pressKey("y")
      await Bun.sleep(20)
    },
    110,
    32,
  )

  expect(frame).toContain("y copy for your agent")
  expect(frame).toContain("Press y to copy this, then paste it into your agent's chat:")
  expect(frame).toContain("▌ Set up srctrek so it can start you to build treks on your own.")
  const copied = frame.includes("✓ Copied. Send it in your agent's chat")
  const toSelect = frame.includes("select the text above to copy it")
  expect(copied || toSelect).toBe(true)
})

test("says when the agent saved its command from its chat", async () => {
  // The settings as trek rereads them: the agent's command arrives after a moment.
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

  expect(frame).toMatch(/Agent +agent run --headless/)
  expect(frame).toContain("✓ your agent saved its command; it starts and answers")
})

test("the request to copy goes once an agent's command is set", async () => {
  const frame = await frameAfter(app({ agent: "agent run --headless" }), async (input) => {
    input.pressKey("S", { shift: true })
    await Bun.sleep(20)
    input.pressKey("j")
    await Bun.sleep(20)
  })

  expect(frame).toMatch(/Agent +agent run --headless/)
  expect(frame).not.toContain("Press c to copy this")
})
