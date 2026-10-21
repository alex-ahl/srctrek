import { useKeyboard } from "@opentui/react"

export function App({ onQuit }: { onQuit: () => void }) {
  useKeyboard((key) => {
    if (key.name === "q") onQuit()
  })
  return (
    <box style={{ border: true, padding: 1 }} title="codetrail">
      <text>No tour yet. Press q to quit.</text>
    </box>
  )
}
