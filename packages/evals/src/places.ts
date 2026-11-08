import type { TrekStep } from "@srctrek/core"
import type { ExpectedLine, ExpectedPlace } from "./expected"

export function inFile(at: ExpectedPlace, place: ExpectedPlace): boolean {
  return at.repo === place.repo && at.file === place.file
}

export function covers(step: TrekStep, line: ExpectedLine): boolean {
  return inFile(step, line) && step.start_line <= line.line && line.line <= step.end_line
}
