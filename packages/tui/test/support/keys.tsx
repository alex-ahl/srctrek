import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import type { ReactNode } from "react"

/** Renders the node, presses enter, and waits for the screen to settle. */
export async function pressEnterOn(node: ReactNode): Promise<void> {
  const { renderer, renderOnce, mockInput } = await createTestRenderer({ width: 100, height: 20 })
  createRoot(renderer).render(node)
  // The React reconciler commits asynchronously; one tick lets the tree mount first.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await renderOnce()

  mockInput.pressEnter()
  await new Promise((resolve) => setTimeout(resolve, 0))
  renderer.destroy()
}
