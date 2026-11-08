import type { Call, NextStop, StepRef, StepView } from "@srctrek/core"

// Views as trek serve sends them, for testing what the extension makes of them.

export const ref: StepRef = {
  id: "s1",
  repo: "app",
  file: "main.ts",
  path: "/app/main.ts",
  trek_copy: false,
  own_path: null,
  start_line: 1,
  end_line: 3,
  name: null,
  summary: "",
}

export function call(id: string, call_line: number | null, fields: Partial<Call> = {}): Call {
  return { ...ref, id, call_line, guessed: false, ...fields }
}

export function stepWith(calls: Call[], next: NextStop, fields: Partial<StepView> = {}): StepView {
  return {
    ...ref,
    kind: "step",
    number: 1,
    count: 4,
    step_kind: "call",
    details: "",
    changed: true,
    stale: false,
    changed_lines: [],
    flag: null,
    predicted_values: [],
    stack: [],
    started_by: null,
    calls,
    context: [],
    notes: [],
    came_from: null,
    next,
    ...fields,
  }
}
