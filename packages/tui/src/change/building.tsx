import { buildProgress } from "@srctrek/core"
import type { BuildRead } from "../build-view/read"
import { clockText } from "../build-view/read"
import { StepLine } from "../build-view/step-line"
import { useBuild } from "../build-view/use-build"
import { STATE_LABELS } from "../ui/state-labels"
import { count, fit } from "../ui/text"
import { useTones } from "../ui/theme"
import { useStateText } from "../ui/turning"

// The latest steps the agent added; the build view has them all.
const STEPS_SHOWN = 8

/** A build as it runs: how long, the steps it has added so far, and what the agent read last. */
export function Building({ read, width }: { read: () => Promise<BuildRead>; width: number }) {
  const tones = useTones()
  const { build, now } = useBuild(read)
  const state = useStateText(STATE_LABELS.building)
  const steps = build?.steps ?? []
  const clock = build === undefined ? "" : clockText(build, now)
  const lastRead = build === undefined ? undefined : buildProgress(build.log).reads.at(-1)
  const so = [clock, steps.length === 0 ? "" : `${count(steps.length, "step")} so far`]

  return (
    <box flexDirection="column">
      <text fg={tones.busy}>
        {state}
        <span fg={tones.dim}>{`  ${so.filter((each) => each !== "").join(" · ")}`}</span>
      </text>
      {steps.slice(-STEPS_SHOWN).map((step) => (
        <StepLine key={step.id} step={step} width={width} />
      ))}
      {lastRead !== undefined && <text fg={tones.dim}>{`     ${fit(lastRead, width - 5)} …`}</text>}
    </box>
  )
}
