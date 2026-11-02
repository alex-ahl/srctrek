import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  type SessionView,
  type StepView,
  type ViewContext,
  openSession,
  parseTour,
  sessionView,
  stepNext,
  stepTo,
} from "../../src"

const fixturePath = join(import.meta.dir, "../fixtures/refund-tour.json")
const tour = parseTour(await Bun.file(fixturePath).json(), fixturePath)
const opened = openSession(tour)

const context: ViewContext = {
  roots: new Map([
    ["web", "/checkouts/web"],
    ["api", "/checkouts/api"],
    ["worker", "/checkouts/worker"],
  ]),
  changedLines: new Map([
    [
      "api",
      new Map([
        [
          "src/handlers/refunds.ts",
          new Map([
            [8, "added" as const],
            [12, "changed" as const],
          ]),
        ],
      ]),
    ],
  ]),
  stale: new Set(["s13"]),
}

function viewOf(id: string): StepView {
  const view = sessionView(stepTo(opened, id), context)
  if (view.kind !== "step") {
    throw new Error(`no step view at ${id}`)
  }

  return view
}

const ids = (refs: { id: string }[]) => refs.map((ref) => ref.id)

describe("sessionView", () => {
  test("shows the overview before the first step, and the outcome past the last", () => {
    const overview: SessionView = sessionView(opened, context)
    const end = sessionView(stepNext(stepTo(opened, "s20")), context)

    expect(overview).toMatchObject({ kind: "overview", title: tour.title, count: 19 })
    expect(end).toMatchObject({ kind: "end", outcome: tour.outcome, count: 19 })
  })

  test("places a step in its repo's checkout, with its number and the lines the change touches", () => {
    const view = viewOf("s11")

    expect(view).toMatchObject({
      number: 11,
      count: 19,
      path: "/checkouts/api/src/handlers/refunds.ts",
      start_line: 8,
      end_line: 19,
      step_kind: "call",
      changed: true,
      stale: false,
    })
    expect(view.changed_lines).toEqual([
      { line: 8, change: "added" },
      { line: 12, change: "changed" },
    ])
    expect(view.flag?.severity).toBe("high")
  })

  test("marks a step whose file has changed since as stale", () => {
    expect(viewOf("s13").stale).toBe(true)
  })

  test("shows the stack back across every hop to the trigger, marking where hops start", () => {
    const stack = viewOf("s13").stack

    // the page load drew the button (s1-s3), the click (s4) led to the request (s8)
    expect(ids(stack)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s11", "s13"])
    expect(stack.filter((frame) => frame.hop).map((frame) => frame.id)).toEqual(["s2", "s4", "s8"])
  })

  test("offers what the step enters, and the context steps that explain it", () => {
    const view = viewOf("s8")

    expect(ids(view.calls)).toEqual(["s11"])
    expect(ids(view.context)).toEqual(["s9", "s10"])
  })

  test("gives a context step no stack and nothing to enter", () => {
    const view = viewOf("s9")

    expect(view.step_kind).toBe("context")
    expect(view.stack).toEqual([])
    expect(view.calls).toEqual([])
  })
})
