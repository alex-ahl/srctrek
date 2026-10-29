import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { nearbyRepos, resolveChange, runGit } from "../../src"
import { commit } from "../support/repo"
import { makeCacheDir } from "../support/remote"

async function repoIn(parent: string, name: string): Promise<string> {
  const dir = join(parent, name)
  await mkdir(dir)
  await runGit(dir, ["init", "--quiet", "--initial-branch=main"])
  await commit(dir, "README.md", `${name}\n`)
  return dir
}

describe("nearbyRepos", () => {
  test("names the other repos beside the current one, leaving out opened ones, worktrees of the same repo, and plain folders", async () => {
    const parent = await realpath(await mkdtemp(join(tmpdir(), "codetrail-nearby-")))
    const web = await repoIn(parent, "web")
    await repoIn(parent, "api")
    await repoIn(parent, "worker")
    await repoIn(parent, "docs")
    await mkdir(join(parent, "notes"))
    await runGit(web, ["worktree", "add", "--quiet", "--detach", join(parent, "web-review")])

    const args = {
      changes: [],
      unchanged: [{ source: "." }, { source: "../docs" }],
      uncommitted: false,
      code: { trigger: undefined },
    }
    const change = await resolveChange(web, args, await makeCacheDir())

    expect(await nearbyRepos(web, change)).toEqual(["../api", "../worker"])
  })
})
