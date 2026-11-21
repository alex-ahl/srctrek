import { expect, mock, test } from "bun:test"
import { App } from "../../src/home/screen"
import type { TrekEntry } from "@srctrek/core"
import type { Editor, StepPlace } from "../../src/editors/editors"
import { frameAfter, pressEnterOn, pressOn } from "../support/keys"

const noop = () => undefined
const neovim: Editor = { id: "nvim", label: "Neovim", command: "nvim", steps: true }
const vim: Editor = { id: "$EDITOR", label: "$EDITOR (vim)", command: "vim", steps: false }
const trigger = {
  kind: "event" as const,
  name: "a reply times out",
  evidence: { repo: "bot", file: "bot.py", line: 91 },
}
const withTrek: TrekEntry = {
  name: "a-reply-times-out",
  path: "/t/a-reply-times-out.json",
  valid: true,
  title: "A reply times out",
  steps: 6,
  highFlags: 0,
  createdAt: "2026-11-09T09:12:00.000Z",
  repos: 1,
  code: false,
  heads: [{ repo: "web", head: { kind: "branch", name: "feature/refunds", uncommitted: false } }],
}

function codeWith(trek: { kind: "missing" | "ready"; name: string }) {
  return { kind: "triggers" as const, name: "bot-code", triggers: [{ trigger, trek }] }
}

test("enter on a trigger with no trek yet builds its trek", async () => {
  const build = mock((_trigger: string) => undefined)
  const status = codeWith({ kind: "missing", name: "a-reply-times-out" })

  await pressEnterOn(
    <App entries={[]} onOpen={noop} onQuit={noop} codeStatus={status} onBuildTrigger={build} />,
  )

  expect(build).toHaveBeenCalledWith("a reply times out")
})

test("enter on a trigger with a trek opens the trek's page", async () => {
  const status = codeWith({ kind: "ready", name: "a-reply-times-out" })
  const frame = await frameAfter(
    <App
      entries={[withTrek]}
      onOpen={noop}
      onQuit={noop}
      codeStatus={status}
      onBuildTrigger={noop}
    />,
    (input) => input.pressEnter(),
  )

  expect(frame).toContain("srctrek › A reply times out")
})

test("enter on the change's trek doesn't open it when a repo it names isn't here", async () => {
  const open = mock((_entry: TrekEntry) => undefined)
  const status = {
    kind: "unreachable" as const,
    name: "a-reply-times-out",
    unreachable: {
      repo: "worker",
      source: "../worker",
      revision: "c".repeat(40),
      reason: "missing" as const,
    },
  }

  await pressEnterOn(<App entries={[withTrek]} onOpen={open} onQuit={noop} status={status} />)

  expect(open).not.toHaveBeenCalled()
})

test("enter on a trek opens its page, not the editor", async () => {
  const open = mock((_entry: TrekEntry) => undefined)
  const frame = await frameAfter(
    <App entries={[withTrek]} onOpen={open} onQuit={noop} editors={[neovim, vim]} editor={vim} />,
    (input) => input.pressEnter(),
  )

  expect(frame).toContain("srctrek › A reply times out")
  expect(open).not.toHaveBeenCalled()
})

test("E offers the terminal first, then the editors found, and picks one", async () => {
  const choose = mock((_place: StepPlace) => undefined)
  const app = (
    <App
      entries={[withTrek]}
      onOpen={noop}
      onQuit={noop}
      editors={[neovim, vim]}
      onChooseEditor={choose}
    />
  )

  const asked = await frameAfter(app, (input) => input.pressKey("E", { shift: true }))
  expect(asked).toContain("Step treks in:")
  expect(asked).toContain("▶ Terminal        here, in trek")
  expect(asked).toContain("  Neovim          nvim")
  expect(asked).toContain("  $EDITOR (vim)   at the first stop, without stepping")

  await pressOn(app, async (input) => {
    input.pressKey("E", { shift: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    input.pressKey("j")
    await new Promise((resolve) => setTimeout(resolve, 0))
    input.pressEnter()
  })
  expect(choose).toHaveBeenCalledWith(neovim)
})

test("E opens the picker on the chosen editor, and esc closes it", async () => {
  const app = (
    <App entries={[withTrek]} onOpen={noop} onQuit={noop} editors={[neovim, vim]} editor={vim} />
  )

  const asked = await frameAfter(app, (input) => input.pressKey("E", { shift: true }))
  expect(asked).toContain("▶ $EDITOR (vim)")

  const closed = await frameAfter(app, async (input) => {
    input.pressKey("E", { shift: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    input.pressEscape()
    // a lone escape is told from the start of a key sequence only after a short wait
    await Bun.sleep(50)
  })
  expect(closed).not.toContain("Step treks in:")
  expect(closed).toContain("enter open · ? keys")
})
