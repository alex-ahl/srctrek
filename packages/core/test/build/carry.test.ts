import { describe, expect, test } from "bun:test"
import {
  type ResolvedChange,
  type SubmittedStep,
  type Trek,
  addSteps,
  carryOver,
  draftToTrek,
  newDraft,
  stepIds,
} from "../../src"
import { changeOf, makeBranchRepo } from "../support/branch"
import { commit } from "../support/repo"

const header = {
  title: "t",
  overview: "o",
  trigger: { kind: "command" as const, input: "i" },
  outcome: "x",
  sources: [],
  author: { model: "m" },
}

// A two-step trek: s1 in total.ts, s2 in pay.ts, citing total.ts as where it came from.
async function trekOf(change: ResolvedChange): Promise<Trek> {
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
    kind: "call",
    from: "s1",
    via: { cites: [{ repo, file: "total.ts", line: 1 }], guessed: false },
  }
  const { draft, problems } = await addSteps(newDraft(change, header), [s1, s2])
  expect(problems).toEqual([])

  return draftToTrek(draft)
}

async function repoWithTrek() {
  const dir = await makeBranchRepo()
  await commit(dir, "total.ts", "export const total = 250\n")
  await commit(dir, "pay.ts", "pay(total)\n")
  return { dir, trek: await trekOf(await changeOf(dir)) }
}

describe("carryOver", () => {
  test("keeps every step whose files are unchanged, at the new commits", async () => {
    const { dir, trek } = await repoWithTrek()
    await commit(dir, "README.md", "more docs\n")
    const change = await changeOf(dir)

    const { draft, redo } = await carryOver(trek, change)

    expect(redo).toEqual([])
    expect(stepIds(draft)).toEqual(["s1", "s2"])
    expect(draftToTrek(draft).repos[0]?.revision).toBe(change.repos[0]?.revision)
    expect(draft.header.title).toBe("t")
  })

  test("redoes a step whose file changed, and one citing a file that changed", async () => {
    const { dir, trek } = await repoWithTrek()
    await commit(dir, "total.ts", "export const total = 300\n")

    const { draft, redo } = await carryOver(trek, await changeOf(dir))

    expect(stepIds(draft)).toEqual([])
    expect(redo.map(({ step, why }) => [step.id, why])).toEqual([
      ["s1", "total.ts changed"],
      ["s2", "it cites total.ts, which changed"],
    ])
  })

  test("redoes a step in a repo that isn't open any more", async () => {
    const { dir, trek } = await repoWithTrek()
    const elsewhere = {
      ...trek,
      steps: trek.steps.map((step) => ({ ...step, repo: "payments" })),
    }

    const { redo } = await carryOver(elsewhere, await changeOf(dir))

    expect(redo[0]?.why).toBe("payments isn't open; propose it again to bring this step back")
  })
})
