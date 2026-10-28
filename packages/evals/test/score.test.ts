import { describe, expect, test } from "bun:test"
import { type Tour, type TourStep, parseTour } from "@codetrail/core"
import { join } from "node:path"
import { readExpected } from "../src/expected"
import { scoreTour } from "../src/score"

const tourPath = join(import.meta.dir, "../../core/test/fixtures/refund-tour.json")
const refundTour = parseTour(await Bun.file(tourPath).json(), tourPath)
const expected = await readExpected(join(import.meta.dir, "../../../evals/fixtures/refund"))

function withoutStepsIn(tour: Tour, file: string): Tour {
  return { ...tour, steps: tour.steps.filter((step) => step.file !== file) }
}

describe("scoreTour", () => {
  test("gives the hand-made refund tour the whole route, both links, every bug line", () => {
    const score = scoreTour(refundTour, expected)

    expect(score.route).toMatchObject({ found: 11, total: 11, inOrder: true, missing: [] })
    expect(score.links.map(({ found }) => found)).toEqual(["cited", "cited"])
    expect(score.bugs.map(({ inSteps, total }) => [inSteps, total])).toEqual([[3, 3]])
  })

  test("names a route entry no step reaches, and a link whose target is never reached", () => {
    const score = scoreTour(withoutStepsIn(refundTour, "worker/handlers/refunds.py"), expected)

    expect(score.route.found).toBe(10)
    expect(score.route.missing.map(({ file }) => file)).toEqual(["worker/handlers/refunds.py"])
    expect(score.links.map(({ found }) => found)).toEqual(["cited", "not reached"])
  })

  test("sees a route walked out of order", () => {
    const steps = refundTour.steps.toReversed()

    expect(scoreTour({ ...refundTour, steps }, expected).route.inOrder).toBe(false)
  })

  // The first link runs from the server (s8) to the refund handler (s11).
  test("tells a guessed link from a cited one, and from one with no evidence", () => {
    const linkSteps = new Set(["s8", "s9", "s10", "s11"])
    const withVia = (via: TourStep["via"]): Tour => ({
      ...refundTour,
      steps: refundTour.steps.map((step) => (linkSteps.has(step.id) ? { ...step, via } : step)),
    })

    const guessed = withVia({
      cites: [{ repo: "api", file: "src/server.ts", line: 39 }],
      guessed: true,
    })
    expect(scoreTour(guessed, expected).links[0]?.found).toBe("guessed")
    expect(scoreTour(withVia(null), expected).links[0]?.found).toBe("no evidence")
  })
})
