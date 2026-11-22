// Compiled by CI into its own binary to prove the native renderer loads from a single file.
import { PendingScreen } from "./opening"
import { renderFrame } from "./render-frame"

const frame = await renderFrame(
  <PendingScreen
    pending={{ kind: "opening", choice: { kind: "own", uncommitted: false } }}
    onBack={() => undefined}
  />,
)
console.log(frame)
if (!frame.includes("opening your branch")) {
  console.error("smoke: expected text missing from frame")
  process.exit(1)
}
