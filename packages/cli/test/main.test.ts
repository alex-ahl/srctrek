import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { makeRepo } from "../../core/test/support/repo"

const MAIN = join(import.meta.dir, "../src/main.ts")

async function runTrail(cwd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  const proc = Bun.spawn(["bun", MAIN, ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited])

  return { code, stderr }
}

describe("trail", () => {
  test("says what's wrong with its arguments, and exits 1", async () => {
    const repo = await makeRepo()

    expect(await runTrail(repo, ["../nowhere-codetrail"])).toEqual({
      code: 1,
      stderr: "trail: no repo at ../nowhere-codetrail\n",
    })
  })
})
