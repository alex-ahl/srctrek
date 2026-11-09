import { expect, mock, test } from "bun:test"
import { App } from "../src/app"
import type { TrekEntry } from "@srctrek/core"
import { pressEnterOn } from "./support/keys"

const noop = () => undefined
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
    <App entries={[withTrek]} onOpen={open} onQuit={noop} status={status} onBuildTrigger={noop} />,
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
