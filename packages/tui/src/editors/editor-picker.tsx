import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import { type Editor, type StepPlace, TERMINAL, isTerminal } from "./editors"
import { KeyHints } from "../ui/footer"
import { moveKeys, stepped } from "../ui/move"
import { PADDING } from "../ui/layout"
import { Selectable } from "../ui/selectable"
import { COLOUR, useTones } from "../ui/theme"

type Props = {
  editors: readonly Editor[]
  // the editor chosen before, picked out to start with; none for the terminal
  current: Editor | undefined
  onPick: (place: StepPlace) => void
  onCancel: () => void
  // the chosen row's background, when the terminal's colours are known
  tint: RGBA | undefined
}

const KEYS = [
  { key: "enter", does: "pick" },
  { key: "esc", does: "cancel" },
]

// What stepping a trek there does, beside its name.
function how(place: StepPlace): string {
  if (isTerminal(place)) {
    return "here, in trek"
  }

  return place.steps ? place.command : "at the first stop, without stepping"
}

/** Asks where treks are stepped: here, or an editor found here; j/k to choose, enter to pick, esc. */
export function EditorPicker({ editors, current, onPick, onCancel, tint }: Props) {
  const tones = useTones()
  const places: StepPlace[] = [TERMINAL, ...editors]
  const [chosen, setChosen] = useState(
    Math.max(
      0,
      places.findIndex((place) => place.id === (current ?? TERMINAL).id),
    ),
  )

  const picked = places[chosen]
  const pick = () => picked !== undefined && onPick(picked)
  // from the selection as it is, so keys pressed faster than the screen redraws each count
  const move = (by: number) => setChosen((at) => stepped(at, by, places.length))
  const keyActions = new Map([
    ["escape", onCancel],
    ["return", pick],
    ["enter", pick],
    ...moveKeys(move),
  ])
  useKeyboard((key) => keyActions.get(key.name)?.())

  const width = Math.max(...places.map((place) => place.label.length)) + 3

  return (
    <box
      flexDirection="column"
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={COLOUR.text}>Step treks in:</text>
      {places.map((place, i) => (
        <Selectable key={place.id} selected={i === chosen} tint={tint}>
          <span {...(i === chosen ? { attributes: TextAttributes.BOLD } : {})}>
            {place.label.padEnd(width)}
          </span>
          <span fg={tones.dim}>{how(place)}</span>
        </Selectable>
      ))}
      <KeyHints keys={KEYS} />
    </box>
  )
}
