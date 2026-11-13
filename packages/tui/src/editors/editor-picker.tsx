import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import type { Editor } from "./editors"
import { PADDING } from "../ui/layout"
import { COLOUR, useTones } from "../ui/theme"

type Props = {
  editors: readonly Editor[]
  // the editor chosen before, picked out to start with
  current: Editor | undefined
  onPick: (editor: Editor) => void
  onCancel: () => void
}

const NONE_FOUND = "No editor to open treks in: install Neovim, or set $EDITOR."

// What opening a trek in it does, beside its name.
const how = (editor: Editor) =>
  editor.steps ? editor.command : "at the first stop, without stepping"

/** Asks which editor treks open in: the editors found here, j/k to choose, enter to pick, esc. */
export function EditorPicker({ editors, current, onPick, onCancel }: Props) {
  const tones = useTones()
  const [chosen, setChosen] = useState(
    Math.max(
      0,
      editors.findIndex((e) => e.id === current?.id),
    ),
  )

  useKeyboard((key) => {
    const picked = editors[chosen]
    if (key.name === "escape") {
      onCancel()
    } else if ((key.name === "return" || key.name === "enter") && picked !== undefined) {
      onPick(picked)
    } else if (key.name === "down" || key.name === "j") {
      setChosen(Math.min(chosen + 1, editors.length - 1))
    } else if (key.name === "up" || key.name === "k") {
      setChosen(Math.max(chosen - 1, 0))
    }
  })

  const width = Math.max(0, ...editors.map((editor) => editor.label.length)) + 3

  return (
    <box
      flexDirection="column"
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={COLOUR.text}>Open treks in:</text>
      {editors.length === 0 && <text fg={tones.dim}>{NONE_FOUND}</text>}
      {editors.map((editor, i) => (
        <text key={editor.id} fg={COLOUR.text}>
          <span fg={tones.accent}>{i === chosen ? "▶ " : "  "}</span>
          <span {...(i === chosen ? { attributes: TextAttributes.BOLD } : {})}>
            {editor.label.padEnd(width)}
          </span>
          <span fg={tones.dim}>{how(editor)}</span>
        </text>
      ))}
      <text fg={tones.dim}>↑/↓ choose · enter pick · esc cancel</text>
    </box>
  )
}
