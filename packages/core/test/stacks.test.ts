import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { callStacks, parseTour } from "../src"

const fixturePath = join(import.meta.dir, "fixtures/refund-tour.json")
const tour = parseTour(await Bun.file(fixturePath).json(), fixturePath)
const { stacks, misplacedReturns } = callStacks(tour.steps)

describe("callStacks", () => {
  test("puts a call on top of the step it came from", () => {
    // the click handler, the refund action, requestRefund, post()
    expect(stacks.get("s7")).toEqual(["s4", "s5", "s6", "s7"])
  })

  test("starts a new stack at a hop", () => {
    expect(stacks.get("s8")).toEqual(["s8"])
    expect(stacks.get("s13")).toEqual(["s8", "s11", "s13"])
  })

  test("leaves context steps off the stack", () => {
    expect(stacks.has("s9")).toBe(false)
    expect(stacks.has("s10")).toBe(false)
  })

  test("puts a return in place of the frame it comes back to", () => {
    // back in the worker's handler (s17) once payments.refund (s18) answers
    expect(stacks.get("s19")).toEqual(["s15", "s19"])
  })

  test("finds the frame a return comes back to across the hop it answers", () => {
    // back in web's refund action (s5) once the api's createRefund (s11) answers the request
    expect(stacks.get("s14")).toEqual(["s4", "s14"])
    expect(misplacedReturns).toEqual([])
  })

  test("follows a return that takes the place of a hop back to the hop's caller", () => {
    // the api's server writes the 202 (s13b), then the response is back in web's action (s14)
    const answered = tour.steps.find((step) => step.id === "s14")
    if (answered === undefined) {
      throw new Error("no s14")
    }
    const written = { ...answered, id: "s13b", repo: "api", file: "src/server.ts", from: "s11" }
    const steps = tour.steps.flatMap((step) =>
      step.id === "s14" ? [written, { ...step, from: "s13b" }] : [step],
    )

    const result = callStacks(steps)

    expect(result.stacks.get("s13b")).toEqual(["s13b"])
    expect(result.stacks.get("s14")).toEqual(["s4", "s14"])
    expect(result.misplacedReturns).toEqual([])
  })

  test("stacks a return that comes back to no frame as a call, and reports it", () => {
    const steps = tour.steps.map((step) =>
      step.id === "s18" ? { ...step, kind: "return" as const } : step,
    )

    const result = callStacks(steps)

    expect(result.misplacedReturns).toEqual(["s18"])
    expect(result.stacks.get("s18")).toEqual(["s15", "s17", "s18"])
    expect(result.stacks.get("s19")).toEqual(["s15", "s19"])
  })
})
