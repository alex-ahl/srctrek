import { expect } from "bun:test"
import {
  type SubmittedStep,
  addSteps,
  draftToTour,
  newDraft,
  runGit,
  saveTour,
} from "@codetrail/core"
import { changeOf } from "../../../core/test/support/branch"
import { commit, makeRepo } from "../../../core/test/support/repo"

const header = {
  title: "Pay",
  overview: "main pays through a helper.",
  trigger: { kind: "command" as const, input: "run main" },
  outcome: "paid",
  sources: [],
  author: { model: "m" },
}

// A repo on branch feature whose change adds main.ts, which calls pay in pay.ts and carries on,
// with the tour of it saved as "pay": main (s1) calls pay (s2), which returns to main (s3). pay
// is named, predicts its result, and carries a high flag.
export async function repoWithTour(): Promise<string> {
  const dir = await makeRepo()
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  await commit(dir, "pay.ts", "export function pay() {\n  return 250\n}\n")
  await commit(dir, "main.ts", "const total = pay()\nconsole.log(total)\n")

  const change = await changeOf(dir)
  const repo = change.repos[0]?.name ?? ""
  const step = (fields: Partial<SubmittedStep>): SubmittedStep => ({
    id: "s1",
    repo,
    file: "main.ts",
    start_line: 1,
    end_line: 1,
    kind: "call",
    summary: "s",
    details: "d",
    via: null,
    ...fields,
  })
  const cites = (file: string, line: number) => ({ cites: [{ repo, file, line }], guessed: false })
  const steps = [
    step({ summary: "main calls pay" }),
    step({
      id: "s2",
      file: "pay.ts",
      end_line: 3,
      from: "s1",
      via: cites("main.ts", 1),
      name: "pay",
      predicted_values: [{ name: "pay", value: "250", line: 2, role: "return" }],
      uncertain: { severity: "high", note: "250 is hard-coded" },
    }),
    step({
      id: "s3",
      start_line: 2,
      end_line: 2,
      kind: "return",
      from: "s2",
      via: cites("pay.ts", 2),
    }),
  ]

  const { draft, problems } = await addSteps(newDraft(change, header), steps)
  expect(problems).toEqual([])
  await saveTour(dir, "pay", draftToTour(draft))

  return dir
}
