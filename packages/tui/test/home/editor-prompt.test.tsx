import { expect, mock, test } from "bun:test"
import { App } from "../../src/home/app"
import type { TrekEntry } from "@srctrek/core"
import type { Editor } from "../../src/editors/editors"
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

function statusWith(trek: { kind: "missing" | "ready"; name: string }) {
  return { kind: "triggers" as const, name: "bot-code", triggers: [{ trigger, trek }] }
}

test("enter on a trigger with no trek yet builds its trek", async () => {
  const build = mock((_trigger: string) => undefined)
  const status = statusWith({ kind: "missing", name: "a-reply-times-out" })

  await pressEnterOn(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuildTrigger={build} />,
  )

  expect(build).toHaveBeenCalledWith("a reply times out")
})

test("enter on a trigger with a trek opens it", async () => {
  const open = mock((_entry: TrekEntry) => undefined)
  const status = statusWith({ kind: "ready", name: "a-reply-times-out" })

  await pressEnterOn(
    <App
      entries={[withTrek]}
      onOpen={open}
      onQuit={noop}
      status={status}
      onBuildTrigger={noop}
      editor={neovim}
    />,
  )

  expect(open).toHaveBeenCalledWith(withTrek)
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

test("enter on a trek before an editor is chosen asks for one, then opens the trek in it", async () => {
  const open = mock((_entry: TrekEntry) => undefined)
  const choose = mock((_editor: Editor) => undefined)
  const app = (
    <App
      entries={[withTrek]}
      onOpen={open}
      onQuit={noop}
      editors={[neovim, vim]}
      onChooseEditor={choose}
    />
  )

  const asked = await frameAfter(app, (input) => input.pressEnter())
  expect(asked).toContain("Open treks in:")
  expect(asked).toContain("▶ Neovim          nvim")
  expect(asked).toContain("  $EDITOR (vim)   at the first stop, without stepping")
  expect(open).not.toHaveBeenCalled()

  await pressOn(app, async (input) => {
    input.pressEnter()
    await new Promise((resolve) => setTimeout(resolve, 0))
    input.pressKey("j")
    await new Promise((resolve) => setTimeout(resolve, 0))
    input.pressEnter()
  })
  expect(choose).toHaveBeenCalledWith(vim)
  expect(open).toHaveBeenCalledWith(withTrek)
})

test("E opens the editor picker on the chosen editor, and esc closes it", async () => {
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
  expect(closed).not.toContain("Open treks in:")
  expect(closed).toContain("enter open in $EDITOR (vim)")
})

test("says when there's no editor to open treks in", async () => {
  const frame = await frameAfter(
    <App entries={[withTrek]} onOpen={noop} onQuit={noop} editors={[]} />,
    (input) => input.pressEnter(),
  )

  expect(frame).toContain("No editor to open treks in: install Neovim, or set $EDITOR.")
})
