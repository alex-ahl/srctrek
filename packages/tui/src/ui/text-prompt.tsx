import { type InputRenderable, RGBA } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useRef } from "react"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"

type Props = {
  question: string
  // what the field holds to start with, to edit rather than retype
  initial?: string | undefined
  // a dim line under the field, on what to type
  hint?: string | undefined
  onSubmit: (answer: string) => void
  onCancel: () => void
}

/** A question answered by typing, in the footer's place; enter answers, esc cancels. */
export function TextPrompt({ question, initial, hint, onSubmit, onCancel }: Props) {
  const tones = useTones()
  // Read from the input itself on enter: its submit event doesn't carry the text, and state
  // set while typing can lag a paste followed straight away by enter.
  const input = useRef<InputRenderable>(null)
  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel()
    }
  })

  // An empty answer is no answer: the field stays open until there's one, or esc.
  const submit = () => {
    const answer = input.current?.value.trim() ?? ""
    if (answer !== "") {
      onSubmit(answer)
    }
  }

  return (
    <box
      flexDirection="column"
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <box flexDirection="row">
        <text fg={COLOUR.text}>{`${question} `}</text>
        <input
          ref={input}
          focused
          value={initial ?? ""}
          onSubmit={submit}
          textColor={COLOUR.text}
          focusedTextColor={COLOUR.text}
          backgroundColor={RGBA.defaultBackground()}
          focusedBackgroundColor={RGBA.defaultBackground()}
          style={{ flexGrow: 1 }}
        />
      </box>
      {hint !== undefined && <text fg={tones.dim}>{hint}</text>}
    </box>
  )
}
