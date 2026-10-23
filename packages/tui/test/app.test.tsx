import { expect, test } from "bun:test"
import { App } from "../src/app"
import { renderFrame } from "../src/render-frame"
import type { TourEntry } from "../src/tour-list"

const noop = () => undefined

test("renders the empty state", async () => {
  const frame = await renderFrame(<App entries={[]} onOpen={noop} onQuit={noop} />)
  expect(frame).toContain("No tours in .codetrail/tours")
})

test("lists valid and invalid tours", async () => {
  const entries: TourEntry[] = [
    {
      name: "refund",
      path: "/t/refund.json",
      valid: true,
      title: "Refund orders",
      steps: 20,
      highFlags: 4,
    },
    {
      name: "broken",
      path: "/t/broken.json",
      valid: false,
      problem: "steps.1.via: missing evidence",
    },
  ]
  const frame = await renderFrame(<App entries={entries} onOpen={noop} onQuit={noop} />, 70, 14)
  expect(frame).toContain("▶ Refund orders")
  expect(frame).toContain("refund · 20 steps  ⚠ 4 high")
  expect(frame).toContain("broken · invalid: steps.1.via: missing evidence")
})
