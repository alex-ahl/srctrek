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

// Builders for a step in `repo`, starting from main.ts's first line, and for evidence there.
function buildersIn(repo: string) {
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

  return { step, cites }
}

// A repo holding `base`, then on branch feature a change committing `files` in order, with the
// steps `stepsIn` gives for its repo saved as the tour "pay".
async function repoWithSteps(
  files: [string, string][],
  stepsIn: (builders: ReturnType<typeof buildersIn>) => SubmittedStep[],
  base: [string, string][] = [],
): Promise<string> {
  const dir = await makeRepo()
  for (const [file, content] of base) {
    await commit(dir, file, content)
  }
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  for (const [file, content] of files) {
    await commit(dir, file, content)
  }

  const change = await changeOf(dir)
  const steps = stepsIn(buildersIn(change.repos[0]?.name ?? ""))
  const { draft, problems } = await addSteps(newDraft(change, header), steps)
  expect(problems).toEqual([])
  await saveTour(dir, "pay", draftToTour(draft))

  return dir
}

// main.ts calls pay in pay.ts and carries on: main (s1) calls pay (s2), which returns to main
// (s3). pay is named, predicts its result, and carries a high flag.
export function repoWithTour(): Promise<string> {
  const files: [string, string][] = [
    ["pay.ts", "export function pay() {\n  return 250\n}\n"],
    ["main.ts", "const total = pay()\nconsole.log(total)\n"],
  ]

  return repoWithSteps(files, ({ step, cites }) => [
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
  ])
}

// main.ts makes two calls, a line each: main (s1) calls pay (s2) on line 1, then send (s3) on
// line 2; the link to send is guessed, and send is flagged risky.
export function repoWithTwoCalls(): Promise<string> {
  const files: [string, string][] = [
    ["pay.ts", "export function pay() {\n  return 250\n}\n"],
    ["send.ts", "export function send(total) {\n  return total\n}\n"],
    ["main.ts", "const total = pay()\nsend(total)\nconsole.log(total)\n"],
  ]

  return repoWithSteps(files, ({ step, cites }) => [
    step({ end_line: 2, summary: "main pays, then sends" }),
    step({ id: "s2", file: "pay.ts", end_line: 3, from: "s1", via: cites("main.ts", 1) }),
    step({
      id: "s3",
      file: "send.ts",
      end_line: 3,
      from: "s1",
      via: { ...cites("main.ts", 2), guessed: true },
      uncertain: { severity: "medium", note: "total may be undefined" },
    }),
  ])
}

// main.ts and pay.ts are on the base branch; the change edits main.ts's second line. main (s1,
// both lines) calls pay (s2).
export function repoWithEdit(): Promise<string> {
  const base: [string, string][] = [
    ["pay.ts", "export function pay() {\n  return 250\n}\n"],
    ["main.ts", "const total = pay()\nconsole.log(total)\n"],
  ]
  const files: [string, string][] = [["main.ts", "const total = pay()\nconsole.log(total * 2)\n"]]

  return repoWithSteps(
    files,
    ({ step, cites }) => [
      step({ end_line: 2, summary: "main pays, then logs double" }),
      step({ id: "s2", file: "pay.ts", end_line: 3, from: "s1", via: cites("main.ts", 1) }),
    ],
    base,
  )
}
