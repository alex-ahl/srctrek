import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import type { ReactNode } from "react"

type MockInput = Awaited<ReturnType<typeof createTestRenderer>>["mockInput"]

/** Renders the node, presses keys with `press`, and waits for the screen to settle. */
export async function pressOn(
  node: ReactNode,
  press: (input: MockInput) => void | Promise<void>,
): Promise<void> {
  const { renderer, renderOnce, mockInput } = await createTestRenderer({ width: 100, height: 20 })
  createRoot(renderer).render(node)
  // The React reconciler commits asynchronously; one tick lets the tree mount first.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await renderOnce()

  await press(mockInput)
  await new Promise((resolve) => setTimeout(resolve, 0))
  renderer.destroy()
}

/** Renders the node, presses enter, and waits for the screen to settle. */
export function pressEnterOn(node: ReactNode): Promise<void> {
  return pressOn(node, (input) => input.pressEnter())
}

/** Renders the node, presses `key`, and waits for the screen to settle. */
export function pressKeyOn(node: ReactNode, key: string): Promise<void> {
  return pressOn(node, (input) => input.pressKey(key))
}

/**
 * The screen under test, for waiting on it between keys: until it shows what a key should bring
 * up, as work a key starts (loading a trek, reading a file) takes as long as it takes; or one draw,
 * for a key that changes the screen at once.
 */
export type Screen = Readonly<{
  shows: (what: string | RegExp) => Promise<void>
  drawn: () => Promise<void>
}>

// How often the screen is looked at while waiting, and how long to wait at most.
const LOOK_MS = 10
const WAIT_MS = 4000

/** Renders the node, presses keys with `press`, and returns the screen they leave. */
export async function frameAfter(
  node: ReactNode,
  press: (input: MockInput, screen: Screen) => void | Promise<void>,
  width = 110,
  height = 24,
): Promise<string> {
  const { renderer, renderOnce, mockInput, captureCharFrame } = await createTestRenderer({
    width,
    height,
  })
  createRoot(renderer).render(node)
  await new Promise((resolve) => setTimeout(resolve, 0))
  await renderOnce()

  const drawn = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await renderOnce()
  }
  const shows = async (what: string | RegExp) => {
    const matches = (frame: string) =>
      typeof what === "string" ? frame.includes(what) : what.test(frame)
    const deadline = Date.now() + WAIT_MS
    await drawn()
    while (!matches(captureCharFrame())) {
      if (Date.now() > deadline) {
        throw new Error(`the screen never showed ${String(what)}:\n${captureCharFrame()}`)
      }

      await Bun.sleep(LOOK_MS)
      await renderOnce()
    }
  }

  await press(mockInput, { shows, drawn })
  await new Promise((resolve) => setTimeout(resolve, 0))
  await renderOnce()
  const frame = captureCharFrame()
  renderer.destroy()

  return frame
}
