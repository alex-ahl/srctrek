import { Fragment } from "react"
import { SEPARATOR } from "./separator"
import { useTones } from "./theme"

/** Text with each separator dimmed, whatever the line around it is drawn in. */
export function Separated({ text }: { text: string }) {
  const tones = useTones()
  return (
    <>
      {text.split(SEPARATOR).map((part, at) => (
        <Fragment key={at}>
          {at > 0 && <span fg={tones.dim}>{SEPARATOR}</span>}
          {part}
        </Fragment>
      ))}
    </>
  )
}
