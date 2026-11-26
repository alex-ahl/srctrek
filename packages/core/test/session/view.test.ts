import { describe, expect, test } from "bun:test"
import {
  type SessionView,
  type StepView,
  type ViewContext,
  openSession,
  parseTrek,
  sessionView,
  stepNext,
  stepTo,
} from "../../src"
import { REFUND_TREK_PATH } from "@srctrek/testing"

const trek = parseTrek(await Bun.file(REFUND_TREK_PATH).json(), REFUND_TREK_PATH)
const opened = openSession(trek)

const context: ViewContext = {
  roots: new Map([
    ["web", "/checkouts/web"],
    ["api", "/checkouts/api"],
    ["worker", "/checkouts/worker"],
  ]),
  own: new Map([["api", { root: "/mine/api", files: new Set(["src/handlers/refunds.ts"]) }]]),
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

    expect(overview).toMatchObject({
      kind: "overview",
      title: trek.title,
      count: 17,
      repos: ["web", "api", "worker"],
      flags: { high: 4, medium: 4, low: 4 },
    })
    expect(end).toMatchObject({ kind: "end", outcome: trek.outcome, count: 17 })
  })

  test("names the steps likely wrong in the overview, in trek order, each with its stop and note", () => {
    const overview = sessionView(opened, context)
    if (overview.kind !== "overview") {
      throw new Error("no overview")
    }

    expect(overview.likely_wrong.map((flag) => `${flag.id}:${String(flag.number)}`)).toEqual([
      "s3:3",
      "s11:9",
      "s16:13",
      "s17:14",
    ])
    expect(
      overview.likely_wrong.every((flag) => flag.severity === "high" && flag.note !== ""),
    ).toBe(true)
  })

  test("lists every flag at the end, most severe first, then in trek order", () => {
    const end = sessionView(stepNext(stepTo(opened, "s20")), context)
    if (end.kind !== "end") {
      throw new Error("no end view")
    }

    expect(end.flags.map((flag) => `${flag.id}:${flag.severity}`)).toEqual([
      "s3:high",
      "s11:high",
      "s16:high",
      "s17:high",
      "s6:medium",
      "s7:medium",
      "s15:medium",
      "s18:medium",
      "s5:low",
      "s9:low",
      "s14:low",
      "s20:low",
    ])
    // s9 is a context step, so it takes the number of the step it explains
    expect(end.flags.find((flag) => flag.id === "s9")?.number).toBe(8)
  })

  test("places a step in its repo's checkout, with its number and the lines the change touches", () => {
    const view = viewOf("s11")

    expect(view).toMatchObject({
      number: 9,
      count: 17,
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

  test("opens the user's own file when it's the trek's version, else the trek's copy", () => {
    expect(viewOf("s11")).toMatchObject({
      path: "/mine/api/src/handlers/refunds.ts",
      trek_copy: false,
    })
    expect(viewOf("s13")).toMatchObject({
      path: "/checkouts/api/src/bus.ts",
      trek_copy: true,
      own_path: "/mine/api/src/bus.ts",
    })
    // web has no checkout of the user's
    expect(viewOf("s1")).toMatchObject({ trek_copy: true, own_path: null })
  })

  test("marks a step whose file has changed since as stale", () => {
    expect(viewOf("s13").stale).toBe(true)
  })

  test("keeps the frames that wait across a hop, back to the hop nobody waits on", () => {
    const view = viewOf("s13")

    // the click (s4) led to the request (s8), which web waits on; nothing waits on the click
    expect(ids(view.stack)).toEqual(["s4", "s5", "s6", "s7", "s8", "s11", "s13"])
    expect(view.stack.filter((frame) => frame.hop).map((frame) => frame.id)).toEqual(["s4", "s8"])
    expect(view.started_by?.id).toBe("s3")
  })

  test("starts a fresh stack at a hop nobody waits on, naming what started it", () => {
    // publish (s13) queued the message; the worker (s15) picks it up on its own
    const view = viewOf("s17")

    expect(ids(view.stack)).toEqual(["s15", "s17"])
    expect(view.started_by?.id).toBe("s13")
  })

  test("names each frame by the function or route its step shows", () => {
    const names = viewOf("s13").stack.map((frame) => frame.name)

    expect(names.slice(-3)).toEqual(["POST /refunds", "createRefund", "publish"])
  })

  test("leaves a step's name empty when the trek doesn't give one", () => {
    const withoutName = (step: (typeof trek.steps)[number]) => {
      const { name: _, ...rest } = step
      return rest
    }
    const unnamed = { ...trek, steps: trek.steps.map(withoutName) }
    const view = sessionView(stepTo(openSession(unnamed), "s11"), context)

    expect(view).toMatchObject({ kind: "step", name: null })
  })

  test("offers what the step enters, and the context steps that explain it", () => {
    const view = viewOf("s8")

    expect(ids(view.calls)).toEqual(["s11"])
    expect(ids(view.context)).toEqual(["s9", "s10"])
  })

  test("numbers the stops, a context step taking the number of the step it explains", () => {
    expect(viewOf("s8").number).toBe(8)
    expect(viewOf("s9").number).toBe(8)
    expect(viewOf("s11").number).toBe(9)
  })

  test("points each call at the line that makes it, from the evidence it cites", () => {
    // the router (s8) dispatches to the refund handler (s11) at server.ts:39
    expect(viewOf("s8").calls).toMatchObject([{ id: "s11", call_line: 39, guessed: false }])
  })

  test("leaves a call's line empty when its evidence points elsewhere", () => {
    const uncited = {
      ...trek,
      steps: trek.steps.map((s) => (s.id === "s11" ? { ...s, via: null } : s)),
    }
    const view = sessionView(stepTo(openSession(uncited), "s8"), context)

    expect(view).toMatchObject({ kind: "step", calls: [{ id: "s11", call_line: null }] })
  })

  test("says where a step came from, by its stop number, with the evidence to open", () => {
    expect(viewOf("s11").came_from).toMatchObject({
      id: "s8",
      relation: "from",
      number: 8,
      guessed: false,
      cites: [
        { repo: "api", file: "src/server.ts", line: 39, path: "/checkouts/api/src/server.ts" },
      ],
    })
  })

  test("marks a link matched only by name as guessed", () => {
    const guess = (s: (typeof trek.steps)[number]) =>
      s.id === "s11" && s.via !== null ? { ...s, via: { ...s.via, guessed: true } } : s
    const guessed = { ...trek, steps: trek.steps.map(guess) }
    const view = sessionView(stepTo(openSession(guessed), "s11"), context)

    expect(view).toMatchObject({ kind: "step", came_from: { id: "s8", guessed: true } })
  })

  test("says which step a context step explains, and that the first step came from the trigger", () => {
    expect(viewOf("s9").came_from).toMatchObject({
      id: "s8",
      relation: "for",
      label: "Explains",
      number: 8,
    })
    expect(viewOf("s1").came_from).toBeNull()
  })

  test("says where next leads: into a call, across a hop, back, on, or to the end", () => {
    expect(viewOf("s11").next).toMatchObject({ how: "into", to: { id: "s13" }, line: 18 })
    expect(viewOf("s11").next.text).toMatch(/^next: into .+, line 18$/)
    expect(viewOf("s7").next).toMatchObject({
      how: "hop",
      to: { id: "s8" },
      line: 10,
      through: "POST from web",
    })
    expect(viewOf("s7").next.text).toBe("next: ↯ POST from web to api: POST /refunds")
    expect(viewOf("s13").next).toMatchObject({ how: "back", to: { id: "s14" }, line: null })
    expect(viewOf("s14").next).toMatchObject({ how: "on", to: { id: "s15" } })
    expect(viewOf("s20").next).toEqual({
      how: "end",
      to: null,
      line: null,
      through: null,
      text: "next: the end of the trek",
    })
  })

  test("says where each move lands, with its stop number", () => {
    expect(viewOf("s5").moves.over).toMatchObject({ id: "s14" })
    expect(viewOf("s16").moves.out).toMatchObject({ id: "s17" })
    expect(viewOf("s11").moves.next).toMatchObject({ id: "s13", number: viewOf("s13").number })
    expect(viewOf("s9").moves.into).toBeNull()
    expect(viewOf("s20").moves.next).toBeNull()
  })

  test("gives a context step no stack and nothing to enter", () => {
    const view = viewOf("s9")

    expect(view.step_kind).toBe("context")
    expect(view.stack).toEqual([])
    expect(view.calls).toEqual([])
  })
})
