import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import type { ReactNode } from "react"

export async function renderFrame(node: ReactNode, width = 60, height = 8): Promise<string> {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width, height })
  createRoot(renderer).render(node)
  // The React reconciler commits asynchronously; one tick lets the tree mount before rendering.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await renderOnce()
  const frame = captureCharFrame()
  renderer.destroy()
  return frame
}
