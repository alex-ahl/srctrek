import {
  type ResolvedChange,
  addSteps,
  draftToTour,
  newDraft,
  parseRange,
  resolveChange,
  runGit,
  saveTour,
} from "../../src"
import { commit, makeRepo } from "./repo"
import { makeCacheDir } from "./remote"

/** A repo on branch feature/refunds, one commit ahead of main. */
export async function makeBranchRepo(): Promise<string> {
  const dir = await makeRepo()
  await runGit(dir, ["switch", "--quiet", "-c", "feature/refunds"])
  await commit(dir, "app.ts", "const total = 250\n")

  return dir
}

/** The change `range` names in the repo at `dir`, as trail would resolve it. */
export async function changeOf(
  dir: string,
  range = "",
  uncommitted = false,
): Promise<ResolvedChange> {
  const args = {
    changes: [{ kind: "range" as const, repo: { source: "." }, range: parseRange(range) }],
    unchanged: [],
    uncommitted,
  }

  return resolveChange(dir, args, await makeCacheDir())
}

/** Saves a one-step tour of the change as `name`, as an agent would through trail mcp. */
export async function saveTourOf(dir: string, change: ResolvedChange, name: string): Promise<void> {
  const header = {
    title: "t",
    overview: "o",
    trigger: { kind: "command" as const, input: "i" },
    outcome: "x",
    sources: [],
    author: { model: "m" },
  }
  const step = {
    id: "s1",
    repo: change.repos[0]?.name ?? "",
    file: "app.ts",
    start_line: 1,
    end_line: 1,
    kind: "call" as const,
    summary: "s",
    details: "d",
    via: null,
  }

  const { draft, problems } = await addSteps(newDraft(change, header), [step])
  if (problems.length > 0) {
    throw new Error(`the test tour has problems: ${problems.join("; ")}`)
  }

  await saveTour(dir, name, draftToTour(draft))
}
