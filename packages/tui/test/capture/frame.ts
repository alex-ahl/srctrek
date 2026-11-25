import type { CapturedFrame } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import type { ReactNode } from "react"

// How long a screen gets to read what it shows, a frame at a time.
const SETTLE_MS = 20
const SETTLE_TRIES = 25

// The frame after a moment, the React reconciler committing asynchronously.
async function drawn(
  renderOnce: () => Promise<void>,
  captureSpans: () => CapturedFrame,
): Promise<CapturedFrame> {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
  await renderOnce()
  return captureSpans()
}

/** What `node` draws on a terminal `width` by `height` cells: each cell's text and style. */
export async function captureScreen(
  node: ReactNode,
  width: number,
  height: number,
): Promise<CapturedFrame> {
  const { renderer, renderOnce, captureSpans } = await createTestRenderer({ width, height })
  createRoot(renderer).render(node)

  // A screen that reads what it shows draws once that's in: drawn again until two frames match.
  let frame = await drawn(renderOnce, captureSpans)
  for (let tries = 0; tries < SETTLE_TRIES; tries++) {
    const next = await drawn(renderOnce, captureSpans)
    if (JSON.stringify(next) === JSON.stringify(frame)) {
      break
    }

    frame = next
  }

  renderer.destroy()
  return frame
}
