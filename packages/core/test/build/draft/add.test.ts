import { describe, expect, test } from "bun:test"
import { type SubmittedStep, addSteps, newDraft } from "../../../src/index"
import { changeOf, commit, makeBranchRepo } from "@srctrek/testing"

const header = {
  title: "t",
  overview: "o",
  trigger: { kind: "command" as const, input: "i" },
  outcome: "x",
  sources: [],
  author: { model: "m" },
}

async function stepsIn() {
  const dir = await makeBranchRepo()
  await commit(dir, "total.ts", "export const total = 250\n")
  await commit(dir, "pay.ts", "pay(total)\n")
  const change = await changeOf(dir)
  const repo = change.repos[0]?.name ?? ""
  const s1: SubmittedStep = {
    id: "s1",
    repo,
    file: "total.ts",
    start_line: 1,
    end_line: 1,
    kind: "call",
    summary: "s",
    details: "d",
    via: null,
  }
  const s2: SubmittedStep = {
    ...s1,
    id: "s2",
    file: "pay.ts",
    via: { cites: [{ repo, file: "total.ts", line: 1 }], guessed: false },
  }

  return { draft: newDraft(change, header), s1, s2 }
}

describe("addSteps", () => {
  test("refuses a step after the first that doesn't say where execution came from", async () => {
    const { draft, s1, s2 } = await stepsIn()

    const { draft: after, problems } = await addSteps(draft, [s1, s2])

    expect(problems).toEqual(["s2.from: missing: name the step execution came from"])
    expect(after.steps).toEqual([])
  })

  test("checks a step's links where it sits among the steps added before", async () => {
    const { draft, s1, s2 } = await stepsIn()
    const { draft: first } = await addSteps(draft, [s1])

    expect((await addSteps(first, [s2])).problems).toEqual([
      "s2.from: missing: name the step execution came from",
    ])
    expect((await addSteps(first, [{ ...s2, from: "s1" }])).problems).toEqual([])
  })
})
