import { expect, mock, test } from "bun:test"
import { App } from "../src/app"
import type { TourEntry } from "../src/tour-list"
import { pressEnterOn } from "./support/keys"

const noop = () => undefined
const trigger = {
  kind: "event" as const,
  name: "a reply times out",
  evidence: { repo: "bot", file: "bot.py", line: 91 },
}
const toured: TourEntry = {
  name: "a-reply-times-out",
  path: "/t/a-reply-times-out.json",
  valid: true,
  title: "A reply times out",
  steps: 6,
  highFlags: 0,
}

function statusWith(tour: { kind: "missing" | "ready"; name: string }) {
  return { kind: "triggers" as const, name: "bot-code", triggers: [{ trigger, tour }] }
}

test("enter on a trigger not toured yet builds its tour", async () => {
  const build = mock((_trigger: string) => undefined)
  const status = statusWith({ kind: "missing", name: "a-reply-times-out" })

  await pressEnterOn(
    <App entries={[]} onOpen={noop} onQuit={noop} status={status} onBuildTrigger={build} />,
  )

  expect(build).toHaveBeenCalledWith("a reply times out")
})

test("enter on a toured trigger opens its tour", async () => {
  const open = mock((_entry: TourEntry) => undefined)
  const status = statusWith({ kind: "ready", name: "a-reply-times-out" })

  await pressEnterOn(
    <App entries={[toured]} onOpen={open} onQuit={noop} status={status} onBuildTrigger={noop} />,
  )

  expect(open).toHaveBeenCalledWith(toured)
})
