import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { listFiles, readFileAt, runGit, snapshotWorkingTree } from "../../src"
import { commit, makeRepo } from "../support/repo"

// What a user would notice changing: the branch, its commit, the index, and the files.
async function userState(dir: string): Promise<string[]> {
  return Promise.all([
    runGit(dir, ["symbolic-ref", "HEAD"]),
    runGit(dir, ["rev-parse", "HEAD"]),
    runGit(dir, ["status", "--porcelain", "--untracked-files=all"]),
    runGit(dir, ["diff", "--cached"]),
  ])
}

describe("snapshotWorkingTree", () => {
  test("commits staged and unstaged edits and new files, leaving out ignored ones", async () => {
    const dir = await makeRepo()
    await commit(dir, ".gitignore", "secret.env\n")
    await commit(dir, "app.ts", "v1\n")
    await commit(dir, "staged.ts", "v1\n")
    await writeFile(join(dir, "app.ts"), "edited\n")
    await writeFile(join(dir, "staged.ts"), "staged\n")
    await runGit(dir, ["add", "staged.ts"])
    await writeFile(join(dir, "new.ts"), "new\n")
    await writeFile(join(dir, "secret.env"), "ignored\n")
    const before = await userState(dir)

    const snapshot = await snapshotWorkingTree(dir)

    expect(await readFileAt(dir, snapshot, "app.ts")).toBe("edited\n")
    expect(await readFileAt(dir, snapshot, "staged.ts")).toBe("staged\n")
    expect(await readFileAt(dir, snapshot, "new.ts")).toBe("new\n")
    expect(await readFileAt(dir, snapshot, "secret.env")).toBeUndefined()
    expect(await runGit(dir, ["rev-parse", `${snapshot}^`])).toBe(before[1] ?? "")
    expect(await runGit(dir, ["rev-parse", `refs/codetrail/snapshots/${snapshot}`])).toBe(snapshot)
    expect(await userState(dir)).toEqual(before)
  })

  test("gives the same commit for the same work, a new one once the work changes", async () => {
    const dir = await makeRepo()
    await writeFile(join(dir, "README.md"), "edited\n")

    const first = await snapshotWorkingTree(dir)
    await Bun.sleep(1100)
    expect(await snapshotWorkingTree(dir)).toBe(first)

    await writeFile(join(dir, "README.md"), "edited again\n")
    expect(await snapshotWorkingTree(dir)).not.toBe(first)
  })

  test("leaves codetrail's own folder as HEAD has it", async () => {
    const dir = await makeRepo()
    const head = await runGit(dir, ["rev-parse", "HEAD"])
    await mkdir(join(dir, ".codetrail/tours"), { recursive: true })
    await writeFile(join(dir, ".codetrail/tours/a.json"), "{}\n")

    expect(await snapshotWorkingTree(dir)).toBe(head)
  })

  test("works when .codetrail is ignored or committed", async () => {
    const ignoring = await makeRepo()
    await commit(ignoring, ".gitignore", ".codetrail\n")
    await mkdir(join(ignoring, ".codetrail/tours"), { recursive: true })
    await writeFile(join(ignoring, ".codetrail/tours/a.json"), "{}\n")
    expect(await snapshotWorkingTree(ignoring)).toBe(await runGit(ignoring, ["rev-parse", "HEAD"]))

    const committing = await makeRepo()
    await mkdir(join(committing, ".codetrail"))
    const head = await commit(committing, ".codetrail/repos", "../api\n")
    await writeFile(join(committing, ".codetrail/repos"), "../api\n../web\n")
    expect(await snapshotWorkingTree(committing)).toBe(head)
  })

  test("is HEAD itself when nothing is uncommitted", async () => {
    const dir = await makeRepo()
    const head = await commit(dir, "app.ts", "v1\n")

    expect(await snapshotWorkingTree(dir)).toBe(head)
    expect((await listFiles({ name: "r", source: ".", dir, revision: head })).paths).toContain(
      "app.ts",
    )
  })
})
