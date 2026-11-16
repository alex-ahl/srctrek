import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { makeRepo } from "@srctrek/testing"

const MAIN = join(import.meta.dir, "../src/main.ts")

async function runTrek(cwd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  const proc = Bun.spawn(["bun", MAIN, ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited])

  return { code, stderr }
}

describe("trek", () => {
  test("says what's wrong with its arguments, and exits 1", async () => {
    const repo = await makeRepo()

    expect(await runTrek(repo, ["../nowhere-srctrek"])).toEqual({
      code: 1,
      stderr: "trek: no repo at ../nowhere-srctrek\n",
    })
  })
})
