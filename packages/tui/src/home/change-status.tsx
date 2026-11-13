import { TextAttributes } from "@opentui/core"
import type { StatusBlock } from "./status-block"
import { COLOUR, useTones } from "../ui/theme"

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
      {keys !== undefined && <text fg={tones.dim}>{`  ${keys}`}</text>}
    </box>
  )
}
