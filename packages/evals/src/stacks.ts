import { type TrekStep, callStacks } from "@srctrek/core"
import type { Expected, ExpectedPlace } from "./expected"
import { covers, inFile } from "./places"

type Checkpoint = Expected["stacks"][number]
type Frame = Checkpoint["frames"][number]

/** How a checkpoint fared: every step showing its line under the expected frames, or not. */
export type StackFound =
  | { kind: "as expected" }
  | { kind: "not in a step" }
  | { kind: "wrong"; step: string; frames: ExpectedPlace[] }

export type StackCheck = Readonly<{ checkpoint: Checkpoint; found: StackFound }>

// The files line up with the frames in order; an optional frame may be missing.
function framesMatch(files: ExpectedPlace[], frames: Frame[]): boolean {
  const [frame, ...laterFrames] = frames
  if (frame === undefined) {
    return files.length === 0
  }

  const [file, ...laterFiles] = files
  const matchesHere =
    file !== undefined && inFile(file, frame) && framesMatch(laterFiles, laterFrames)

  return matchesHere || (frame.optional === true && framesMatch(files, laterFrames))
}

// Each step on a stack, with the frames under it, outermost first: its stack without itself.
function stackedSteps(steps: TrekStep[]): { step: TrekStep; frames: TrekStep[] }[] {
  const { stacks } = callStacks(steps)
  const byId = new Map(steps.map((step) => [step.id, step]))

  return steps.flatMap((step) => {
    const stack = stacks.get(step.id)
    if (stack === undefined) {
      return []
    }

    return [{ step, frames: stack.slice(0, -1).flatMap((id) => byId.get(id) ?? []) }]
  })
}

function checkpointFound(
  stacked: { step: TrekStep; frames: TrekStep[] }[],
  checkpoint: Checkpoint,
): StackFound {
  const showing = stacked.filter(({ step }) => covers(step, checkpoint.at))
  if (showing.length === 0) {
    return { kind: "not in a step" }
  }

  const wrong = showing.find(({ frames }) => !framesMatch(frames, checkpoint.frames))
  if (wrong !== undefined) {
    return { kind: "wrong", step: wrong.step.id, frames: wrong.frames }
  }

  return { kind: "as expected" }
}

/** Checks each checkpoint against the call stacks worked out from the trek's links. */
export function checkStacks(steps: TrekStep[], checkpoints: Checkpoint[]): StackCheck[] {
  const stacked = stackedSteps(steps)

  return checkpoints.map((checkpoint) => ({
    checkpoint,
    found: checkpointFound(stacked, checkpoint),
  }))
}
