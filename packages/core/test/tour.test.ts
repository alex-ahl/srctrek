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

const fixturePath = join(import.meta.dir, "fixtures/refund-tour.json")
const fixture = parseTour(await Bun.file(fixturePath).json(), fixturePath)

function refundTour(): Tour {
  return structuredClone(fixture)
}

function step(tour: Tour, id: string) {
  const found = tour.steps.find((s) => s.id === id)
  if (!found) throw new Error(`no step ${id}`)
  return found
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("expected a rejection")
}

function issuesOf(data: unknown): string[] {
  try {
    parseTour(data, "test")
    return []
  } catch (error) {
    if (error instanceof TourValidationError) return error.issues
    throw error
  }
}

describe("parseTour", () => {
  test("accepts the refund tour", () => {
    expect(issuesOf(refundTour())).toEqual([])
  })

  test("rejects a cross-repo link that cites one side only", () => {
    const tour = refundTour()
    const queueHop = step(tour, "s15")
    queueHop.via = { cites: [{ repo: "api", file: "src/bus.ts", line: 10 }], guessed: false }
    expect(issuesOf(tour)).toEqual([
      "steps.14.via: crosses repos without citing worker: cite both sides or mark guessed",
    ])
  })

  test("accepts a one-sided cross-repo link marked guessed", () => {
    const tour = refundTour()
    step(tour, "s15").via = {
      cites: [{ repo: "api", file: "src/bus.ts", line: 10 }],
      guessed: true,
    }
    expect(issuesOf(tour)).toEqual([])
  })

  test("rejects a step after the first without evidence", () => {
    const tour = refundTour()
    step(tour, "s2").via = null
    expect(issuesOf(tour)).toEqual(["steps.1.via: missing evidence"])
  })

  test("rejects references to unknown repos and steps", () => {
    const tour = refundTour()
    step(tour, "s1").repo = "mobile"
    step(tour, "s1").calls = "s99"
    expect(issuesOf(tour)).toEqual([
      "steps.0.repo: unknown repo mobile",
      "steps.0.calls: calls unknown step s99",
    ])
  })

  test("rejects duplicate step ids", () => {
    const tour = refundTour()
    step(tour, "s2").id = "s1"
    expect(issuesOf(tour)).toContain("steps.1.id: duplicate step id s1")
  })

  test("rejects a line range that ends before it starts", () => {
    const tour = refundTour()
    step(tour, "s1").end_line = 1
    step(tour, "s1").start_line = 5
    expect(issuesOf(tour)).toEqual(["steps.0.end_line: end_line is before start_line"])
  })

  test("rejects an uncertain flag without a severity", () => {
    const tour = refundTour()
    Object.assign(step(tour, "s3"), { uncertain: "a bare string" })
    expect(issuesOf(tour)).toEqual([
      "steps.2.uncertain: Invalid input: expected object, received string",
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
