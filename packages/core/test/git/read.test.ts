import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { blobAt, readFileAt, runGit } from "../../src"
import { commit, makeRepo } from "@srctrek/testing"

describe("readFileAt", () => {
  test("reads the committed text exactly, even when the working copy has changed", async () => {
    const repo = await makeRepo()
    const first = await commit(repo, "app.ts", "line one\nline two\n")
    await writeFile(join(repo, "app.ts"), "edited but not committed\n")

    expect(await readFileAt(repo, first, "app.ts")).toBe("line one\nline two\n")
  })

  test("reads an older revision after the file moved on", async () => {
    const repo = await makeRepo()
    const first = await commit(repo, "app.ts", "v1\n")
    await commit(repo, "app.ts", "v2\n")

    expect(await readFileAt(repo, first, "app.ts")).toBe("v1\n")
  })

  test("says a file isn't there rather than failing", async () => {
    const repo = await makeRepo()
    expect(await readFileAt(repo, "HEAD", "missing.ts")).toBeUndefined()
  })
})

describe("blobAt", () => {
  test("gives the id git stores the file's content under", async () => {
    const repo = await makeRepo()
    const head = await commit(repo, "app.ts", "content\n")
    await writeFile(join(repo, "copy.ts"), "content\n")

    expect(await blobAt(repo, head, "app.ts")).toBe(await runGit(repo, ["hash-object", "copy.ts"]))
    expect(await blobAt(repo, head, "missing.ts")).toBeUndefined()
  })
})
