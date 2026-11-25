import type { DraftStep } from "@srctrek/core"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

// A step's id and repo columns, before its summary.
const ID_WIDTH = 5
const REPO_WIDTH = 8

const FLAG_WORDS = { high: "⚠ likely wrong", medium: "● risky", low: "● worth knowing" } as const

/** A step of the draft: its id, repo, and summary, a hop marked, and its flag when it has one. */
export function StepLine({ step, width }: { step: DraftStep; width: number }) {
  const tones = useTones()
  const flag = step.flag === null ? "" : FLAG_WORDS[step.flag]
  const summary = `${step.kind === "hop" ? "↯ " : ""}${step.summary}`
  const room = width - 2 - ID_WIDTH - REPO_WIDTH - (flag === "" ? 0 : flag.length + 2)

  return (
    <text fg={COLOUR.text}>
      <span fg={tones.dim}>{`  ${step.id.padEnd(ID_WIDTH)}`}</span>
      {fit(step.repo, REPO_WIDTH - 1).padEnd(REPO_WIDTH)}
      {fit(summary, room)}
      {flag !== "" && <span fg={step.flag === "high" ? tones.bad : tones.warn}>{`  ${flag}`}</span>}
    </text>
  )
}
