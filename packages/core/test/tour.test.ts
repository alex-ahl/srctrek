import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type Tour,
  TourValidationError,
  listTours,
  loadTour,
  parseTour,
  saveTour,
  tourPath,
} from "../src"
import { rejection } from "./support/rejection"
import { tempDir } from "./support/temp"

const fixturePath = join(import.meta.dir, "fixtures/refund-tour.json")
const fixture = parseTour(await Bun.file(fixturePath).json(), fixturePath)

function refundTour(): Tour {
  return structuredClone(fixture)
}

function step(tour: Tour, id: string) {
  const found = tour.steps.find((s) => s.id === id)
  if (!found) {
    throw new Error(`no step ${id}`)
  }

  return found
}

function issuesOf(data: unknown): string[] {
  try {
    parseTour(data, "test")
    return []
  } catch (error) {
    if (error instanceof TourValidationError) {
      return error.issues
    }

    throw error
  }
}

const BOTH_SIDES = "cite both sides or mark guessed"

describe("parseTour", () => {
  test("accepts the refund tour", () => {
    expect(issuesOf(refundTour())).toEqual([])
  })

  test("rejects a cross-repo link that cites only the sending side", () => {
    const tour = refundTour()
    step(tour, "s15").via = {
      cites: [{ repo: "api", file: "src/bus.ts", line: 10 }],
      guessed: false,
    }
    expect(issuesOf(tour)).toEqual([
      `steps.13 (s15).via: crosses from api to worker without citing worker: ${BOTH_SIDES}`,
    ])
  })

  test("rejects a cross-repo link that cites only the receiving side", () => {
    const tour = refundTour()
    step(tour, "s15").via = {
      cites: [{ repo: "worker", file: "worker/handlers/__init__.py", line: 8 }],
      guessed: false,
    }
    expect(issuesOf(tour)).toEqual([
      `steps.13 (s15).via: crosses from api to worker without citing api: ${BOTH_SIDES}`,
    ])
  })

  test("judges crossing by where execution came from, not by tour order", () => {
    const tour = refundTour()
    // s14 (web) sits between s13 (api) and s15 (worker), but s15 comes from s13
    step(tour, "s15").via = {
      cites: [
        { repo: "web", file: "src/actions.ts", line: 10 },
        { repo: "worker", file: "worker/handlers/__init__.py", line: 8 },
      ],
      guessed: false,
    }
    expect(issuesOf(tour)).toEqual([
      `steps.13 (s15).via: crosses from api to worker without citing api: ${BOTH_SIDES}`,
    ])
  })

  test("rejects a return across repos that cites only the caller's side", () => {
    const tour = refundTour()
    step(tour, "s3").via = {
      cites: [{ repo: "web", file: "src/main.ts", line: 17 }],
      guessed: false,
    }
    expect(issuesOf(tour)).toEqual([
      `steps.2 (s3).via: crosses from api to web without citing api: ${BOTH_SIDES}`,
    ])
  })

  test("rejects a context step explaining a step in another repo that cites only its own side", () => {
    const tour = refundTour()
    step(tour, "s9").for = "s7"
    expect(issuesOf(tour)).toEqual([
      `steps.8 (s9).via: crosses from web to api without citing web: ${BOTH_SIDES}`,
    ])
  })

  test("accepts a one-sided cross-repo link marked guessed", () => {
    const tour = refundTour()
    step(tour, "s15").via = {
      cites: [{ repo: "worker", file: "worker/handlers/__init__.py", line: 8 }],
      guessed: true,
    }
    expect(issuesOf(tour)).toEqual([])
  })

  test("rejects a step after the first without evidence or a source", () => {
    const tour = refundTour()
    step(tour, "s2").via = null
    delete step(tour, "s5").from
    expect(issuesOf(tour)).toEqual([
      "steps.1 (s2).via: missing evidence",
      "steps.4 (s5).from: missing: name the step execution came from",
    ])
  })

  test("rejects references to unknown repos and steps", () => {
    const tour = refundTour()
    step(tour, "s1").repo = "mobile"
    step(tour, "s5").from = "s98"
    step(tour, "s9").for = "s97"
    const issues = issuesOf(tour)
    expect(issues).toContain("steps.0 (s1).repo: unknown repo mobile")
    expect(issues).toContain("steps.4 (s5).from: comes from unknown step s98")
    expect(issues).toContain("steps.8 (s9).for: explains unknown step s97")
  })

  test("rejects a context step linked as executed", () => {
    const tour = refundTour()
    delete step(tour, "s9").for
    step(tour, "s9").from = "s8"
    expect(issuesOf(tour)).toEqual([
      "steps.8 (s9).for: missing: name the step this context explains",
      "steps.8 (s9).from: a context step isn't executed: name the step it explains with for, not from",
    ])
  })

  test("rejects an executed step that names a step it explains", () => {
    const tour = refundTour()
    step(tour, "s11").for = "s8"
    expect(issuesOf(tour)).toEqual([
      "steps.10 (s11).for: only a context step explains another; this one is executed",
    ])
  })

  test("rejects execution coming from a context step", () => {
    const tour = refundTour()
    step(tour, "s11").from = "s10"
    expect(issuesOf(tour)).toContain(
      "steps.10 (s11).from: comes from context step s10, which isn't executed: name the step execution came from",
    )
  })

  test("rejects execution coming from a later step", () => {
    const tour = refundTour()
    step(tour, "s5").from = "s6"
    expect(issuesOf(tour)).toEqual([
      "steps.4 (s5).from: comes from s6, which isn't before it: execution comes from an earlier step",
    ])
  })

  test("accepts a return to a caller across a hop", () => {
    // s14 is back in web's refund action (s5) once the api's createRefund (s11) answers
    expect(step(refundTour(), "s14")).toMatchObject({ kind: "return", from: "s11" })
    expect(issuesOf(refundTour())).toEqual([])
  })

  test("rejects a return to code no step on the stack is in", () => {
    const tour = refundTour()
    // the worker's handler (s17) hands the refund to payments.refund: a call, not a return
    step(tour, "s18").kind = "return"
    expect(issuesOf(tour)).toEqual([
      "steps.16 (s18).kind: returns to worker/payments.py, which no step on the stack below s17 is in: a function the value is handed to is a call, code that runs later is a hop",
    ])
  })

  test("rejects duplicate step ids", () => {
    const tour = refundTour()
    step(tour, "s2").id = "s1"
    expect(issuesOf(tour)).toContain("steps.1 (s1).id: duplicate step id s1")
  })

  test("rejects a line range that ends before it starts", () => {
    const tour = refundTour()
    step(tour, "s1").end_line = 1
    step(tour, "s1").start_line = 5
    expect(issuesOf(tour)).toEqual(["steps.0 (s1).end_line: end_line is before start_line"])
  })

  test("rejects a predicted value outside its step's lines", () => {
    const tour = refundTour()
    step(tour, "s1").predicted_values = [
      { name: "orderId", value: '"o_1001"', line: 30, role: "assignment" },
    ]
    expect(issuesOf(tour)).toEqual([
      "steps.0 (s1).predicted_values.0.line: orderId is on line 30, outside the step's lines 4-18",
    ])
  })

  test("rejects an uncertain flag without a severity", () => {
    const tour = refundTour()
    Object.assign(step(tour, "s3"), { uncertain: "a bare string" })
    expect(issuesOf(tour)).toEqual([
      "steps.2 (s3).uncertain: Invalid input: expected object, received string",
    ])
  })
})

describe("saving and loading", () => {
  test("round-trips a tour and lists it", async () => {
    const root = await tempDir("tours-")
    const path = await saveTour(root, "refund", refundTour())
    expect(await loadTour(path)).toEqual(refundTour())
    expect(await listTours(root)).toEqual(["refund"])
  })

  test("skips files that aren't named like tours", async () => {
    const root = await tempDir("tours-")
    await saveTour(root, "refund", refundTour())
    await writeFile(join(root, ".codetrail/tours/refund.changed.json"), "{}")
    expect(await listTours(root)).toEqual(["refund"])
  })

  test("lists nothing when no tours were saved", async () => {
    const root = await tempDir("tours-")
    expect(await listTours(root)).toEqual([])
  })

  test("refuses to save an invalid tour", async () => {
    const root = await tempDir("tours-")
    const tour = refundTour()
    step(tour, "s2").via = null
    expect(await rejection(saveTour(root, "broken", tour))).toBeInstanceOf(TourValidationError)
    expect(await listTours(root)).toEqual([])
  })

  test("reports a file that isn't JSON", async () => {
    const root = await tempDir("tours-")
    const path = join(root, "bad.json")
    await writeFile(path, "{ not json")
    expect(await rejection(loadTour(path))).toBeInstanceOf(TourValidationError)
  })

  test("rejects tour names that aren't simple slugs", () => {
    expect(() => tourPath("/repo", "../escape")).toThrow("tour name")
  })
})
