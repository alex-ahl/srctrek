import { TextAttributes } from "@opentui/core"
import type { StatusBlock } from "./status-block"
import { COLOUR } from "./theme"

/** Where the change's trek stands: the state in its colour, then dim lines on why and the keys. */
export function ChangeStatus({ block }: { block: StatusBlock }) {
  const { symbol, state, colour, name, holds, flag, details, keys } = block

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      <text fg={COLOUR.text}>
        <span fg={colour} attributes={TextAttributes.BOLD}>{`${symbol} ${state}`}</span>
        {name === undefined ? "" : "  "}
        {name !== undefined && <span attributes={TextAttributes.BOLD}>{name}</span>}
        {holds === undefined ? "" : <span fg={COLOUR.dim}>{`  ${holds}`}</span>}
        {flag === undefined ? "" : <span fg={COLOUR.bad}>{`   ${flag}`}</span>}
      </text>
      {details.map((line, i) => (
        <text key={i} fg={COLOUR.dim}>{`  ${line}`}</text>
      ))}
      {keys !== undefined && <text fg={COLOUR.dim}>{`  ${keys}`}</text>}
    </box>
  )
}
