import { describe, expect, test } from "bun:test"
import { choiceStatus, runGit } from "../../src"
import { makeBranchRepo } from "../support/branch"
import { commit } from "../support/repo"

describe("choiceStatus", () => {
  test("says whether a trek of the chosen branch exists, without switching to it", async () => {
    const dir = await makeBranchRepo()
    await runGit(dir, ["switch", "--quiet", "-c", "fix/rounding", "main"])
    await commit(dir, "round.ts", "export const round = Math.round\n")

    const other = await choiceStatus(dir, { kind: "branch", name: "feature/refunds" })

    expect(other).toMatchObject({ kind: "missing", name: "feature-refunds" })
    expect(await runGit(dir, ["branch", "--show-current"])).toBe("fix/rounding")
  })
})
