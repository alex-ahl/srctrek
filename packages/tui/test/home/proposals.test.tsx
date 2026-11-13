import { expect, mock, test } from "bun:test"
import type { ProposedRepo, TrekEntry } from "@srctrek/core"
import { App } from "../../src/home/app"
import { renderFrame } from "../../src/render-frame"
import { pressEnterOn, pressKeyOn, pressOn } from "../support/keys"

const noop = () => undefined
const payments: ProposedRepo = {
  name: "payments",
  source: "git@example.test:shop/payments.git",
  reason: "the client posts refunds to the payments service",
  evidence: [{ repo: "web", file: "src/pay.ts", line: 30 }],
}
const refund: TrekEntry = {
  name: "refund",
  path: "/t/refund.json",
  valid: true,
  title: "Refund orders",
  steps: 20,
  highFlags: 0,
  createdAt: "2026-11-09T09:12:00.000Z",
  repos: 1,
  code: false,
  heads: [{ repo: "web", head: { kind: "branch", name: "feature/refunds", uncommitted: false } }],
}

test("lists a proposed repo first, with where it lives and why, and how to settle it", async () => {
  const frame = await renderFrame(
    <App
      entries={[refund]}
      onOpen={noop}
      onQuit={noop}
      proposals={[payments]}
      onAddRepo={noop}
      onDismissRepo={noop}
    />,
    120,
    20,
  )

  expect(frame).toContain(" PROPOSED BY THE AGENT")
  expect(frame).toContain(
    "▶ + proposed   payments   git@example.test:shop/payments.git   the client posts refunds to …   enter add · d dismiss",
  )
  expect(frame).toContain(" OTHER BRANCHES AND PULL REQUESTS")
  expect(frame).toContain("enter add to the repos list · d dismiss")
})

test("enter on a proposed repo adds it; d dismisses it", async () => {
  const add = mock((_name: string) => undefined)
  const dismiss = mock((_name: string) => undefined)
  const app = (
    <App
      entries={[]}
      onOpen={noop}
      onQuit={noop}
      proposals={[payments]}
      onAddRepo={add}
      onDismissRepo={dismiss}
    />
  )

  await pressEnterOn(app)
  await pressKeyOn(app, "d")

  expect(add).toHaveBeenCalledWith("payments")
  expect(dismiss).toHaveBeenCalledWith("payments")
})

test("d on a trek does nothing", async () => {
  const dismiss = mock((_name: string) => undefined)

  await pressKeyOn(
    <App entries={[refund]} onOpen={noop} onQuit={noop} onDismissRepo={dismiss} />,
    "d",
  )

  expect(dismiss).not.toHaveBeenCalled()
})

const api: ProposedRepo = {
  name: "api",
  reason: "the web posts refunds to /refunds on the API",
  evidence: [{ repo: "web", file: "src/api.ts", line: 9 }],
}

// Lets the input mount after enter opens it, before keys go to it.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test("says when the agent couldn't find where a proposed repo lives", async () => {
  const frame = await renderFrame(
    <App entries={[]} onOpen={noop} onQuit={noop} proposals={[api]} onAddRepo={noop} />,
    120,
    20,
  )

  expect(frame).toContain(
    "▶ + proposed   api   location unknown   the web posts refunds to /refunds on the API",
  )
})

test("enter on a proposal without a location asks for one, and adds the repo there", async () => {
  const add = mock((_name: string, _location?: string) => undefined)
  const quit = mock(() => undefined)
  const app = <App entries={[]} onOpen={noop} onQuit={quit} proposals={[api]} onAddRepo={add} />

  await pressOn(app, async (input) => {
    input.pressEnter()
    await tick()
    await input.typeText("../quick-api")
    input.pressEnter()
  })

  expect(add).toHaveBeenCalledWith("api", "../quick-api")
  expect(quit).not.toHaveBeenCalled()
})

test("esc leaves the location unasked, and adds nothing", async () => {
  const add = mock((_name: string, _location?: string) => undefined)
  const app = <App entries={[]} onOpen={noop} onQuit={noop} proposals={[api]} onAddRepo={add} />

  await pressOn(app, async (input) => {
    input.pressEnter()
    await tick()
    input.pressEscape()
    await tick()
    input.pressEnter()
    await tick()
    input.pressEscape()
  })

  expect(add).not.toHaveBeenCalled()
})
