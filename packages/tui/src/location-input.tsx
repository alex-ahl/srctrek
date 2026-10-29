import type { InputRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useRef } from "react"

type Props = {
  name: string
  onSubmit: (location: string) => void
  onCancel: () => void
}

/** Asks where a proposed repo lives, when the agent couldn't find out: a path or a URL. */
export function LocationInput({ name, onSubmit, onCancel }: Props) {
  // Read from the input itself on enter: its submit event doesn't carry the text, and state
  // set while typing can lag a paste followed straight away by enter.
  const input = useRef<InputRenderable>(null)
  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel()
    }
  })

  // An empty answer is no answer: the input stays open until there's one, or esc.
  const submit = () => {
    const location = input.current?.value.trim() ?? ""
    if (location !== "") {
      onSubmit(location)
    }
  }

  return (
    <box flexDirection="row" style={{ flexShrink: 0 }}>
      <text>{`Where does ${name} live? A path or URL, esc to cancel: `}</text>
      <input ref={input} focused onSubmit={submit} style={{ flexGrow: 1 }} />
    </box>
  )
}
