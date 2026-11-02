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
  test("gives the hand-made refund tour the whole route, both links, the bug flagged high", () => {
    const score = scoreTour(refundTour, expected)

    expect(score.route).toMatchObject({
      found: 10,
      total: 10,
      inOrder: true,
      missing: [],
      skipped: [],
    })
    expect(score.links.map(({ found }) => found)).toEqual(["cited", "cited"])
    // orders.ts, actions.ts, web refunds.ts, api refunds.ts, worker refunds.py
    expect(score.bugs.map(({ lines }) => lines)).toEqual([
      ["high", "low", "medium", "high", "high"],
    ])
    expect(score.flags).toEqual({ steps: 19, high: 4, medium: 4, low: 4 })
    expect(score.stacks.map(({ found }) => found.kind)).toEqual([
      "as expected",
      "as expected",
      "as expected",
      "as expected",
    ])
  })

  test("tells a response labelled a hop from one that comes back to its caller", () => {
    // s14, back in web's refund action once the api answers, starts a stack of its own as a hop
    const steps = refundTour.steps.map((step) =>
      step.id === "s14" ? { ...step, kind: "hop" as const } : step,
    )

    const back = scoreTour({ ...refundTour, steps }, expected).stacks[3]

    expect(back?.found).toEqual({ kind: "wrong", step: "s14", frames: [] })
  })

  test("tells a handler shown under the step that drew its button", () => {
    // the click handler (s4) labelled a call from the render (s3) that drew the button
    const steps = refundTour.steps.map((step) =>
      step.id === "s4" ? { ...step, kind: "call" as const } : step,
    )

    const post = scoreTour({ ...refundTour, steps }, expected).stacks[0]

    expect(post?.found).toMatchObject({ kind: "wrong", step: "s7" })
  })

  test("tells a bug walked past from one flagged", () => {
    const unflagged = refundTour.steps.map((step) => ({ ...step, uncertain: undefined }))
    const lower = refundTour.steps.map((step) =>
      step.uncertain === undefined
        ? step
        : { ...step, uncertain: { ...step.uncertain, severity: "medium" as const } },
    )
    const withoutWorker = refundTour.steps.filter((step) => step.repo !== "worker")

    const linesOf = (steps: TourStep[]) =>
      scoreTour({ ...refundTour, steps }, expected).bugs[0]?.lines

    expect(linesOf(unflagged)).toEqual(Array(5).fill("unflagged"))
    expect(linesOf(lower)).toEqual(["medium", "medium", "medium", "medium", "medium"])
    expect(linesOf(withoutWorker)).toEqual(["high", "low", "medium", "high", "not in a step"])
  })

  test("names a route entry no step reaches, and a link whose target is never reached", () => {
    const score = scoreTour(withoutStepsIn(refundTour, "worker/handlers/refunds.py"), expected)

    expect(score.route.found).toBe(9)
    expect(score.route.missing.map(({ file }) => file)).toEqual(["worker/handlers/refunds.py"])
    expect(score.links.map(({ found }) => found)).toEqual(["cited", "not reached"])
  })

  test("takes one step covering two route entries, and a file visited twice, as in order", () => {
    const [first] = refundTour.steps
    if (first === undefined) {
      throw new Error("the refund tour has no steps")
    }

    const at = (file: string, start: number, end: number) => ({
      ...first,
      repo: "shop",
      file,
      start_line: start,
      end_line: end,
    })
    const expire = {
      ...expected,
      route: [
        { repo: "shop", file: "store.ts", lines: [8, 11] as [number, number] },
        { repo: "shop", file: "time.ts", lines: [7, 9] as [number, number] },
        { repo: "shop", file: "store.ts", lines: [13, 15] as [number, number] },
        { repo: "shop", file: "stock.ts", lines: [5, 11] as [number, number] },
      ],
    }
    const steps = [
      at("store.ts", 8, 15),
      at("time.ts", 7, 9),
      at("store.ts", 13, 15),
      at("stock.ts", 5, 11),
    ]

    expect(scoreTour({ ...refundTour, steps }, expire).route).toMatchObject({
      found: 4,
      inOrder: true,
    })
  })

  test("tells an optional entry skipped from a required one missed", () => {
    const route = scoreTour(withoutStepsIn(refundTour, "openapi.json"), expected).route

    expect(route).toMatchObject({ found: 10, total: 10, missing: [] })
    expect(route.skipped.map(({ file }) => file)).toEqual(["openapi.json"])
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

  test("scores a repo by the folder it was read from, whatever the tour named it", () => {
    const renamed = (name: string) => (name === "api" ? "payments" : name)
    const tour: Tour = {
      ...refundTour,
      repos: refundTour.repos.map((repo) => ({ ...repo, name: renamed(repo.name) })),
      steps: refundTour.steps.map((step) => ({ ...step, repo: renamed(step.repo) })),
    }

    expect(scoreTour(tour, expected).route).toMatchObject({ found: 10, total: 10, missing: [] })
  })

  test("names the decoys a tour stepped into, and how often", () => {
    const withDecoy = { ...expected, decoys: ["worker", "docs"] }

    expect(scoreTour(refundTour, withDecoy).decoys).toEqual([{ repo: "worker", steps: 6 }])
  })
})
