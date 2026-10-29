import { runGit } from "../../src"
import { commit, makeRepo } from "./repo"
import { tempDir } from "./temp"

export type Remote = { url: string; dir: string; main: string; prHead: string }

/**
 * A repo standing in for a code host: main, plus a pull request head reachable only through
 * refs/pull/1/head, as on a real host.
 */
export async function makeRemote(): Promise<Remote> {
  const dir = await makeRepo()
  await runGit(dir, ["config", "uploadpack.allowFilter", "true"])
  const main = await commit(dir, "app.ts", "base\n")

  await runGit(dir, ["switch", "--quiet", "-c", "contributor"])
  const prHead = await commit(dir, "app.ts", "change\n")
  await runGit(dir, ["update-ref", "refs/pull/1/head", prHead])
  await runGit(dir, ["switch", "--quiet", "main"])
  await runGit(dir, ["branch", "--quiet", "-D", "contributor"])

  return { url: `file://${dir}`, dir, main, prHead }
}

export async function makeCacheDir(): Promise<string> {
  return tempDir("cache-")
}
