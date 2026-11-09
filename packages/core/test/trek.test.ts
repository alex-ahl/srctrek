import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type Trek,
  TrekValidationError,
  listTreks,
  loadTrek,
  parseTrek,
  saveTrek,
  trekPath,
} from "../src"
import { rejection } from "./support/rejection"
import { tempDir } from "./support/temp"

const fixturePath = join(import.meta.dir, "fixtures/refund-trek.json")
const fixture = parseTrek(await Bun.file(fixturePath).json(), fixturePath)

function refundTrek(): Trek {
  return structuredClone(fixture)
}

function step(trek: Trek, id: string) {
  const found = trek.steps.find((s) => s.id === id)
  if (!found) {
    throw new Error(`no step ${id}`)
  }

  return found
}

function issuesOf(data: unknown): string[] {
  try {
    parseTrek(data, "test")
    return []
  } catch (error) {
    if (error instanceof TrekValidationError) {
      return error.issues
    }

    throw error
  }
}

const BOTH_SIDES = "cite both sides or mark guessed"

describe("parseTrek", () => {
  test("needs a head on exactly the repos with a range", () => {
    const trek = refundTrek()
    const [web, ...rest] = trek.repos
    if (web === undefined) {
      throw new Error("no repo")
    }
    const { head: _head, ...withoutHead } = web
    const { range: _range, ...withoutRange } = web

    expect(issuesOf({ ...trek, repos: [withoutHead, ...rest] })).toEqual([
      "repos.0.head: a repo names its head exactly when it has a range",
    ])
    expect(issuesOf({ ...trek, repos: [withoutRange, ...rest] })).toEqual([
      "repos.0.head: a repo names its head exactly when it has a range",
    ])
  })

  test("accepts the refund trek", () => {
    expect(issuesOf(refundTrek())).toEqual([])
  })

  test("rejects a cross-repo link that cites only the sending side", () => {
    const trek = refundTrek()
    step(trek, "s15").via = {
      cites: [{ repo: "api", file: "src/bus.ts", line: 10 }],
      guessed: false,
    }
    expect(issuesOf(trek)).toEqual([
      `steps.13 (s15).via: crosses from api to worker without citing worker: ${BOTH_SIDES}`,
    ])
  })

  test("rejects a cross-repo link that cites only the receiving side", () => {
    const trek = refundTrek()
    step(trek, "s15").via = {
      cites: [{ repo: "worker", file: "worker/handlers/__init__.py", line: 8 }],
      guessed: false,
    }
    expect(issuesOf(trek)).toEqual([
      `steps.13 (s15).via: crosses from api to worker without citing api: ${BOTH_SIDES}`,
    ])
  })

  test("judges crossing by where execution came from, not by trek order", () => {
    const trek = refundTrek()
    // s14 (web) sits between s13 (api) and s15 (worker), but s15 comes from s13
    step(trek, "s15").via = {
      cites: [
        { repo: "web", file: "src/actions.ts", line: 10 },
        { repo: "worker", file: "worker/handlers/__init__.py", line: 8 },
      ],
      guessed: false,
    }
    expect(issuesOf(trek)).toEqual([
      `steps.13 (s15).via: crosses from api to worker without citing api: ${BOTH_SIDES}`,
    ])
  })

  test("rejects a return across repos that cites only the caller's side", () => {
    const trek = refundTrek()
    step(trek, "s3").via = {
      cites: [{ repo: "web", file: "src/main.ts", line: 17 }],
      guessed: false,
    }
    expect(issuesOf(trek)).toEqual([
      `steps.2 (s3).via: crosses from api to web without citing api: ${BOTH_SIDES}`,
    ])
  })

  test("rejects a context step explaining a step in another repo that cites only its own side", () => {
    const trek = refundTrek()
    step(trek, "s9").for = "s7"
    expect(issuesOf(trek)).toEqual([
      `steps.8 (s9).via: crosses from web to api without citing web: ${BOTH_SIDES}`,
    ])
  })

  test("accepts a one-sided cross-repo link marked guessed", () => {
    const trek = refundTrek()
    step(trek, "s15").via = {
      cites: [{ repo: "worker", file: "worker/handlers/__init__.py", line: 8 }],
      guessed: true,
    }
    expect(issuesOf(trek)).toEqual([])
  })

  test("rejects a step after the first without evidence or a source", () => {
    const trek = refundTrek()
    step(trek, "s2").via = null
    delete step(trek, "s5").from
    expect(issuesOf(trek)).toEqual([
      "steps.1 (s2).via: missing evidence",
      "steps.4 (s5).from: missing: name the step execution came from",
    ])
  })

  test("rejects references to unknown repos and steps", () => {
    const trek = refundTrek()
    step(trek, "s1").repo = "mobile"
    step(trek, "s5").from = "s98"
    step(trek, "s9").for = "s97"
    const issues = issuesOf(trek)
    expect(issues).toContain("steps.0 (s1).repo: unknown repo mobile")
    expect(issues).toContain("steps.4 (s5).from: comes from unknown step s98")
    expect(issues).toContain("steps.8 (s9).for: explains unknown step s97")
  })

  test("rejects a context step linked as executed", () => {
    const trek = refundTrek()
    delete step(trek, "s9").for
    step(trek, "s9").from = "s8"
    expect(issuesOf(trek)).toEqual([
      "steps.8 (s9).for: missing: name the step this context explains",
      "steps.8 (s9).from: a context step isn't executed: name the step it explains with for, not from",
    ])
  })

  test("rejects an executed step that names a step it explains", () => {
    const trek = refundTrek()
    step(trek, "s11").for = "s8"
    expect(issuesOf(trek)).toEqual([
      "steps.10 (s11).for: only a context step explains another; this one is executed",
    ])
  })

  test("rejects execution coming from a context step", () => {
    const trek = refundTrek()
    step(trek, "s11").from = "s10"
    expect(issuesOf(trek)).toContain(
      "steps.10 (s11).from: comes from context step s10, which isn't executed: name the step execution came from",
    )
  })

  test("rejects execution coming from a later step", () => {
    const trek = refundTrek()
    step(trek, "s5").from = "s6"
    expect(issuesOf(trek)).toEqual([
      "steps.4 (s5).from: comes from s6, which isn't before it: execution comes from an earlier step",
    ])
  })

  test("accepts a return to a caller across a hop", () => {
    // s14 is back in web's refund action (s5) once the api's createRefund (s11) answers
    expect(step(refundTrek(), "s14")).toMatchObject({ kind: "return", from: "s11" })
    expect(issuesOf(refundTrek())).toEqual([])
  })

  test("rejects a return to code no step on the stack is in", () => {
    const trek = refundTrek()
    // the worker's handler (s17) hands the refund to payments.refund: a call, not a return
    step(trek, "s18").kind = "return"
    expect(issuesOf(trek)).toEqual([
      "steps.16 (s18).kind: returns to worker/payments.py, which no step on the stack below s17 is in: a function the value is handed to is a call, code that runs later is a hop",
    ])
  })

  test("rejects duplicate step ids", () => {
    const trek = refundTrek()
    step(trek, "s2").id = "s1"
    expect(issuesOf(trek)).toContain("steps.1 (s1).id: duplicate step id s1")
  })

  test("rejects a line range that ends before it starts", () => {
    const trek = refundTrek()
    step(trek, "s1").end_line = 1
    step(trek, "s1").start_line = 5
    expect(issuesOf(trek)).toEqual(["steps.0 (s1).end_line: end_line is before start_line"])
  })

  test("rejects a predicted value outside its step's lines", () => {
    const trek = refundTrek()
    step(trek, "s1").predicted_values = [
      { name: "orderId", value: '"o_1001"', line: 30, role: "assignment" },
    ]
    expect(issuesOf(trek)).toEqual([
      "steps.0 (s1).predicted_values.0.line: orderId is on line 30, outside the step's lines 4-18",
    ])
  })

  test("rejects an uncertain flag without a severity", () => {
    const trek = refundTrek()
    Object.assign(step(trek, "s3"), { uncertain: "a bare string" })
    expect(issuesOf(trek)).toEqual([
      "steps.2 (s3).uncertain: Invalid input: expected object, received string",
    ])
  })
})

describe("saving and loading", () => {
  test("round-trips a trek and lists it", async () => {
    const root = await tempDir("treks-")
    const path = await saveTrek(root, "refund", refundTrek())
    expect(await loadTrek(path)).toEqual(refundTrek())
    expect(await listTreks(root)).toEqual(["refund"])
  })

  test("skips files that aren't named like treks", async () => {
    const root = await tempDir("treks-")
    await saveTrek(root, "refund", refundTrek())
    await writeFile(join(root, ".srctrek/treks/refund.changed.json"), "{}")
    expect(await listTreks(root)).toEqual(["refund"])
  })

  test("lists nothing when no treks were saved", async () => {
    const root = await tempDir("treks-")
    expect(await listTreks(root)).toEqual([])
  })

  test("refuses to save an invalid trek", async () => {
    const root = await tempDir("treks-")
    const trek = refundTrek()
    step(trek, "s2").via = null
    expect(await rejection(saveTrek(root, "broken", trek))).toBeInstanceOf(TrekValidationError)
    expect(await listTreks(root)).toEqual([])
  })

  test("reports a file that isn't JSON", async () => {
    const root = await tempDir("treks-")
    const path = join(root, "bad.json")
    await writeFile(path, "{ not json")
    expect(await rejection(loadTrek(path))).toBeInstanceOf(TrekValidationError)
  })

  test("rejects trek names that aren't simple slugs", () => {
    expect(() => trekPath("/repo", "../escape")).toThrow("trek name")
  })
})
