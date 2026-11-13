// Compiled by CI into its own binary to prove the native renderer loads from a single file.
import { App } from "./home/app"
import { renderFrame } from "./render-frame"

const frame = await renderFrame(
  <App entries={[]} onOpen={() => undefined} onQuit={() => undefined} />,
)
console.log(frame)
if (!frame.includes("No treks")) {
  console.error("smoke: expected text missing from frame")
  process.exit(1)
}
