import type { CapturedFrame } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import type { ReactNode } from "react"

/** What `node` draws on a terminal `width` by `height` cells: each cell's text and style. */
export async function captureScreen(
  node: ReactNode,
  width: number,
  height: number,
): Promise<CapturedFrame> {
  const { renderer, renderOnce, captureSpans } = await createTestRenderer({ width, height })
  createRoot(renderer).render(node)

  // The React reconciler commits asynchronously; one tick lets the tree mount before rendering.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await renderOnce()
  const frame = captureSpans()

  renderer.destroy()
  return frame
}
