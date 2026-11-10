import { expect, mock, test } from "bun:test"
import type { Settings, TrekEntry } from "@srctrek/core"
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
