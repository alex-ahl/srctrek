import { describe, expect, test } from "bun:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
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
      `steps.14 (s15).via: crosses from api to worker without citing worker: ${BOTH_SIDES}`,
    ])
  })

  test("rejects a cross-repo link that cites only the receiving side", () => {
    const tour = refundTour()
    step(tour, "s15").via = {
      cites: [{ repo: "worker", file: "worker/handlers/__init__.py", line: 8 }],
      guessed: false,
    }
    expect(issuesOf(tour)).toEqual([
      `steps.14 (s15).via: crosses from api to worker without citing api: ${BOTH_SIDES}`,
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
      `steps.14 (s15).via: crosses from api to worker without citing api: ${BOTH_SIDES}`,
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
    step(tour, "s1").calls = "s99"
    step(tour, "s5").from = "s98"
    const issues = issuesOf(tour)
    expect(issues).toContain("steps.0 (s1).repo: unknown repo mobile")
    expect(issues).toContain("steps.0 (s1).calls: calls unknown step s99")
    expect(issues).toContain("steps.4 (s5).from: comes from unknown step s98")
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
    const root = await mkdtemp(join(tmpdir(), "codetrail-"))
    const path = await saveTour(root, "refund", refundTour())
    expect(await loadTour(path)).toEqual(refundTour())
    expect(await listTours(root)).toEqual(["refund"])
  })

  test("skips files that aren't named like tours", async () => {
    const root = await mkdtemp(join(tmpdir(), "codetrail-"))
    await saveTour(root, "refund", refundTour())
    await writeFile(join(root, ".codetrail/tours/refund.changed.json"), "{}")
    expect(await listTours(root)).toEqual(["refund"])
  })

  test("lists nothing when no tours were saved", async () => {
    const root = await mkdtemp(join(tmpdir(), "codetrail-"))
    expect(await listTours(root)).toEqual([])
  })

  test("refuses to save an invalid tour", async () => {
    const root = await mkdtemp(join(tmpdir(), "codetrail-"))
    const tour = refundTour()
    step(tour, "s2").via = null
    expect(await rejection(saveTour(root, "broken", tour))).toBeInstanceOf(TourValidationError)
    expect(await listTours(root)).toEqual([])
  })

  test("reports a file that isn't JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "codetrail-"))
    const path = join(root, "bad.json")
    await writeFile(path, "{ not json")
    expect(await rejection(loadTour(path))).toBeInstanceOf(TourValidationError)
  })

  test("rejects tour names that aren't simple slugs", () => {
    expect(() => tourPath("/repo", "../escape")).toThrow("tour name")
  })
})
