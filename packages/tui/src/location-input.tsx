import { type InputRenderable, RGBA } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useRef } from "react"
import { PADDING } from "./layout"
import { COLOUR } from "./theme"

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
    <box
      flexDirection="row"
      border={["top"]}
      borderColor={COLOUR.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={COLOUR.text}>{`Where does ${name} live? A path or URL, esc to cancel: `}</text>
      <input
        ref={input}
        focused
        onSubmit={submit}
        textColor={COLOUR.text}
        focusedTextColor={COLOUR.text}
        backgroundColor={RGBA.defaultBackground()}
        focusedBackgroundColor={RGBA.defaultBackground()}
        style={{ flexGrow: 1 }}
      />
    </box>
  )
}
