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
