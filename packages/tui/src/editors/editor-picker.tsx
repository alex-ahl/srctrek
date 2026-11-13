import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import type { Editor } from "./editors"
import { keysText } from "../ui/footer"
import { moveKeys, stepped } from "../ui/move"
import { PADDING } from "../ui/layout"
import { Selectable } from "../ui/selectable"
import { COLOUR, useTones } from "../ui/theme"

type Props = {
  editors: readonly Editor[]
  // the editor chosen before, picked out to start with
  current: Editor | undefined
  onPick: (editor: Editor) => void
  onCancel: () => void
  // the chosen row's background, when the terminal's colours are known
  tint: RGBA | undefined
}

const KEYS = [
  { key: "↑/↓", does: "choose" },
  { key: "enter", does: "pick" },
  { key: "esc", does: "cancel" },
]

const NONE_FOUND = "No editor to open treks in: install Neovim, or set $EDITOR."

// What opening a trek in it does, beside its name.
const how = (editor: Editor) =>
  editor.steps ? editor.command : "at the first stop, without stepping"

/** Asks which editor treks open in: the editors found here, j/k to choose, enter to pick, esc. */
export function EditorPicker({ editors, current, onPick, onCancel, tint }: Props) {
  const tones = useTones()
  const [chosen, setChosen] = useState(
    Math.max(
      0,
      editors.findIndex((e) => e.id === current?.id),
    ),
  )

  const picked = editors[chosen]
  const pick = () => picked !== undefined && onPick(picked)
  // from the selection as it is, so keys pressed faster than the screen redraws each count
  const move = (by: number) => setChosen((at) => stepped(at, by, editors.length))
  const keyActions = new Map([
    ["escape", onCancel],
    ["return", pick],
    ["enter", pick],
    ...moveKeys(move),
  ])
  useKeyboard((key) => keyActions.get(key.name)?.())

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
        <Selectable key={editor.id} selected={i === chosen} tint={tint}>
          <span {...(i === chosen ? { attributes: TextAttributes.BOLD } : {})}>
            {editor.label.padEnd(width)}
          </span>
          <span fg={tones.dim}>{how(editor)}</span>
        </Selectable>
      ))}
      <text fg={tones.dim}>{keysText(KEYS)}</text>
    </box>
  )
}
