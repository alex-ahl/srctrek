import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  type SteppingSession,
  currentStep,
  openSession,
  parseTour,
  stepBack,
  stepInto,
  stepNext,
  stepOut,
  stepOver,
  stepTo,
} from "../../src"

const fixturePath = join(import.meta.dir, "../fixtures/refund-tour.json")
const tour = parseTour(await Bun.file(fixturePath).json(), fixturePath)
const opened = openSession(tour)

// Where the session stands: the current step's id, or "overview" or "end".
function at(session: SteppingSession): string {
  return currentStep(session)?.id ?? session.at.kind
}

const on = (id: string) => stepTo(opened, id)

describe("moving in tour order", () => {
  test("opens at the overview, and goes back to it from the first step", () => {
    expect(at(opened)).toBe("overview")
    expect(at(stepNext(opened))).toBe("s1")
    expect(at(stepBack(on("s1")))).toBe("overview")
    expect(at(stepBack(opened))).toBe("overview")
  })

  test("goes past the last step to the end, and back from it to the last step", () => {
    const end = stepNext(on("s20"))

    expect(at(end)).toBe("end")
    expect(at(stepNext(end))).toBe("end")
    expect(at(stepBack(end))).toBe("s20")
  })

  test("passes over context steps, which the step they explain offers", () => {
    // s9 and s10 explain the route match in s8
    expect(at(stepNext(on("s8")))).toBe("s11")
    expect(at(stepBack(on("s11")))).toBe("s8")
  })

  test("goes on from a context step opened from the step it explains", () => {
    expect(at(stepNext(on("s9")))).toBe("s11")
    expect(at(stepBack(on("s10")))).toBe("s8")
  })

  test("stays put when asked for a step the tour doesn't have", () => {
    expect(at(stepTo(on("s5"), "s99"))).toBe("s5")
  })

  test("records each step it shows", () => {
    const walked = stepNext(stepNext(on("s5")))

    expect([...walked.visited]).toEqual(["s5", "s6", "s7"])
  })
})

describe("stepping into", () => {
  test("enters a request's handler from the call that sends it, past context steps", () => {
    expect(at(stepInto(on("s7")))).toBe("s8")
    expect(at(stepInto(on("s8")))).toBe("s11")
  })

  test("enters the first call not yet visited, or the one asked for", () => {
    // the poll loop (s15) reads the queue (s16), then calls the handler (s17)
    const afterRead = stepInto(on("s15"))

    expect(at(afterRead)).toBe("s16")
    expect(at(stepInto(stepTo(afterRead, "s15")))).toBe("s17")
    expect(at(stepInto(on("s15"), "s17"))).toBe("s17")
  })

  test("stays put with nothing to enter", () => {
    expect(at(stepInto(on("s15"), "s18"))).toBe("s15")
    expect(at(stepInto(on("s20")))).toBe("s20")
    expect(at(stepInto(on("s9")))).toBe("s9")
  })
})

describe("stepping over and out", () => {
  test("steps over a request and the work it waits for, back into the caller", () => {
    // the refund action (s5) awaits requestRefund; the api answers and s14 is back in it
    expect(at(stepOver(on("s5")))).toBe("s14")
  })

  test("steps over a call to where the function carries on after it", () => {
    // the worker's handler (s17) calls payments.refund (s18), then carries on in s19
    expect(at(stepOver(on("s17")))).toBe("s19")
  })

  test("steps out to the next step outside the function", () => {
    expect(at(stepOut(on("s16")))).toBe("s17")
    expect(at(stepOut(on("s13")))).toBe("s14")
  })

  test("treats work a hop starts and nobody waits for as running on its own", () => {
    // publish (s13) queues the worker's message; the worker (s15) runs apart from the click
    expect(at(stepOver(on("s4")))).toBe("s15")
    expect(at(stepOut(on("s5")))).toBe("s15")
  })

  test("goes past the last step when nothing is left outside", () => {
    expect(at(stepOut(on("s17")))).toBe("end")
  })

  test("moves on to the next step from a context step", () => {
    expect(at(stepOver(on("s9")))).toBe("s11")
    expect(at(stepOut(on("s10")))).toBe("s11")
  })
})
