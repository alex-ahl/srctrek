import { describe, expect, test } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type ProposedRepo,
  acceptProposal,
  dismissProposal,
  loadProposals,
  proposalProblems,
  readReposList,
  resolveChange,
  saveProposal,
} from "../../src"
import { makeBranchRepo } from "../support/branch"
import { commit } from "../support/repo"
import { makeCacheDir } from "../support/remote"

async function codeOf(dir: string) {
  const args = {
    changes: [],
    unchanged: [{ source: "." }],
    uncommitted: false,
    code: { trigger: undefined },
  }
  return resolveChange(dir, args, await makeCacheDir())
}

function payments(repo: string, line: number): ProposedRepo {
  return {
    name: "payments",
    source: "git@example.test:shop/payments.git",
    reason: "the client posts refunds to the payments service",
    evidence: [{ repo, file: "pay.ts", line }],
  }
}

describe("proposed repos", () => {
  test("are checked: evidence lines exist and aren't blank, and the name is free", async () => {
    const dir = await makeBranchRepo()
    await commit(dir, "pay.ts", "post(PAYMENTS_URL)\n\n")
    const change = await codeOf(dir)
    const repo = change.repos[0]?.name ?? ""

    expect(await proposalProblems(change, payments(repo, 1))).toEqual([])
    expect(await proposalProblems(change, payments(repo, 2))).toEqual([
      `cites ${repo}/pay.ts:2, which is blank`,
    ])
    expect(await proposalProblems(change, { ...payments(repo, 1), name: repo })).toEqual([
      `${repo} is already on the route`,
    ])
  })

  test("are kept by name until added or dismissed", async () => {
    const dir = await makeBranchRepo()
    const first = payments("app", 1)
    const again = { ...first, reason: "found again" }

    await saveProposal(dir, first)
    await saveProposal(dir, again)
    expect(await loadProposals(dir)).toEqual([again])

    await dismissProposal(dir, "payments")
    expect(await loadProposals(dir)).toEqual([])
  })

  test("once added, are on the repos list under their name and no longer proposed", async () => {
    const dir = await makeBranchRepo()
    // written by hand, without a final newline
    await mkdir(join(dir, ".codetrail"))
    await writeFile(join(dir, ".codetrail/repos"), "../web")
    await saveProposal(dir, payments("app", 1))

    await acceptProposal(dir, "payments")

    expect(await readFile(join(dir, ".codetrail/repos"), "utf8")).toBe(
      "../web\npayments = git@example.test:shop/payments.git\n",
    )
    expect(await readReposList(dir)).toContainEqual({
      name: "payments",
      source: "git@example.test:shop/payments.git",
    })
    expect(await loadProposals(dir)).toEqual([])
  })
})
