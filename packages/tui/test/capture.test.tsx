import { RGBA, TextAttributes } from "@opentui/core"
import { expect, test } from "bun:test"
import { screenText } from "./capture/as-text"
import { captureScreen } from "./capture/frame"
import { DARK, LIGHT, dimmed, shownColour } from "./capture/palettes"
import { playOutput } from "./capture/terminal"

test("an ANSI colour and the terminal's default take the palette's colours", () => {
  expect(shownColour(RGBA.fromIndex(2), "fg", DARK)).toBe("#8fcf7a")
  expect(shownColour(RGBA.fromIndex(2), "fg", LIGHT)).toBe("#116329")
  expect(shownColour(RGBA.defaultForeground(), "fg", LIGHT)).toBe(LIGHT.fg)
  expect(shownColour(RGBA.fromHex("#ffffff"), "fg", LIGHT)).toBe("#ffffff")
  expect(shownColour(RGBA.fromValues(0, 0, 0, 0), "bg", LIGHT)).toBe(LIGHT.bg)
})

test("dim text sits halfway to the background", () => {
  expect(dimmed("#ffffff", "#000000")).toBe("#808080")
})

test("the screen's text names where its colours and attributes are", async () => {
  const frame = await captureScreen(
    <box flexDirection="column">
      <text fg={RGBA.defaultForeground()}>plain</text>
      <text fg={RGBA.fromIndex(2)} attributes={TextAttributes.BOLD}>
        ● ready
      </text>
    </box>,
    12,
    2,
  )

  expect(screenText(frame)).toBe("plain\n● ready\n\nstyles:\n 1: 0-6 green bold\n")
})

test("a program's output is played through an emulator, up to where it leaves its screen", async () => {
  const drawn = "\x1b[?1049h\x1b[1;1H\x1b[38;5;2m\x1b[1m● ready\x1b[0m\x1b[2;3H\x1b[39mplain"
  const frame = await playOutput(`${drawn}\x1b[?1049l`, 12, 2)

  expect(screenText(frame)).toBe("● ready\n  plain\n\nstyles:\n 0: 0-6 green bold\n")
})
