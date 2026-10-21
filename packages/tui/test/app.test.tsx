import { expect, test } from "bun:test"
import { App } from "../src/app"
import { renderFrame } from "../src/render-frame"

test("renders the empty state", async () => {
  const frame = await renderFrame(<App onQuit={() => undefined} />)
  expect(frame).toContain("No tour yet")
})
