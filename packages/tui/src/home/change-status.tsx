import { TextAttributes } from "@opentui/core"
import type { StatusBlock } from "./status-block"
import { COLOUR, useTones } from "../ui/theme"

// A hint's key, when it starts with one: "b" in "b build it", "enter" in "enter open it".
const keyOf = (hint: string) => {
  const [first = ""] = hint.split(" ")
  return first.length === 1 || first === "enter" ? first : undefined
}

// The keys line: each key in the text colour, so it stands out as the thing to press, the rest dim.
function Keys({ keys }: { keys: string }) {
  const tones = useTones()
  const hints = keys.split(" · ")

  return (
    <text fg={tones.dim}>
      {"  "}
      {hints.map((hint, i) => {
        const key = keyOf(hint)
        const sep = i === 0 ? "" : " · "
        return key === undefined ? (
          <span key={i}>{`${sep}${hint}`}</span>
        ) : (
          <span key={i}>
            {sep}
            <span fg={COLOUR.text}>{key}</span>
            {hint.slice(key.length)}
          </span>
        )
      })}
    </text>
  )
}

/** Where the change's trek stands: the state in its colour, then dim lines on why and the keys. */
export function ChangeStatus({ block }: { block: StatusBlock }) {
  const { symbol, state, tone, name, holds, flag, details, keys } = block
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      <text fg={COLOUR.text}>
        <span fg={tones[tone]}>{`${symbol} ${state}`}</span>
        {name === undefined ? "" : "  "}
        {name !== undefined && <span attributes={TextAttributes.BOLD}>{name}</span>}
        {holds === undefined ? "" : <span fg={tones.dim}>{`  ${holds}`}</span>}
        {flag === undefined ? "" : <span fg={tones.bad}>{`   ${flag}`}</span>}
      </text>
      {details.map((line, i) => (
        <text key={i} fg={tones.dim}>{`  ${line}`}</text>
      ))}
      {keys !== undefined && <Keys keys={keys} />}
    </box>
  )
}
