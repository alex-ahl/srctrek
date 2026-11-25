import type { CapturedFrame } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import type { ReactNode } from "react"

// How long a screen gets to read what it shows, a frame at a time; it's settled once its frames
// stay the same longer than the landing page waits before it works out the change selected.
const SETTLE_MS = 20
const SETTLE_TRIES = 60
const STILL_FRAMES = 10

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

  // A screen that reads what it shows draws once that's in: drawn again until it stays still.
  let frame = await drawn(renderOnce, captureSpans)
  let still = 0
  for (let tries = 0; tries < SETTLE_TRIES && still < STILL_FRAMES; tries++) {
    const next = await drawn(renderOnce, captureSpans)
    still = JSON.stringify(next) === JSON.stringify(frame) ? still + 1 : 0
    frame = next
  }

  renderer.destroy()
  return frame
}
