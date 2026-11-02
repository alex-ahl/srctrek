import { type TourStep, callStacks } from "@codetrail/core"
import type { Expected, ExpectedPlace } from "./expected"
import { covers, inFile } from "./places"

type Checkpoint = Expected["stacks"][number]
type Frame = Checkpoint["frames"][number]

/** How a checkpoint fared: every step showing its line under the expected frames, or not. */
export type StackFound =
  | { kind: "as expected" }
  | { kind: "not in a step" }
  | { kind: "wrong"; step: string; frames: ExpectedPlace[] }

export type StackCheck = { checkpoint: Checkpoint; found: StackFound }

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

/** Checks each checkpoint against the call stacks worked out from the tour's links. */
export function checkStacks(steps: TourStep[], checkpoints: Checkpoint[]): StackCheck[] {
  const { stacks } = callStacks(steps)
  const byId = new Map(steps.map((step) => [step.id, step]))
  // The frames under a step, outermost first: its stack without itself.
  const framesUnder = (step: TourStep) =>
    (stacks.get(step.id) ?? []).slice(0, -1).flatMap((id) => byId.get(id) ?? [])

  const check = (checkpoint: Checkpoint): StackFound => {
    const showing = steps.filter((step) => stacks.has(step.id) && covers(step, checkpoint.at))
    if (showing.length === 0) {
      return { kind: "not in a step" }
    }

    const wrong = showing.find((step) => !framesMatch(framesUnder(step), checkpoint.frames))
    if (wrong !== undefined) {
      return { kind: "wrong", step: wrong.id, frames: framesUnder(wrong) }
    }

    return { kind: "as expected" }
  }

  return checkpoints.map((checkpoint) => ({ checkpoint, found: check(checkpoint) }))
}
