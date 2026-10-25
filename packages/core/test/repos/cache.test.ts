import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cachePath, cachedRepo, fetchRefs, runGit } from "../../src"
import { commit, makeRepo } from "../support/repo"
import { rejection } from "../support/rejection"

// A repo standing in for a code host: main, plus a pull request head reachable only through
// its pull request ref, as on a real host.
async function makeRemote(): Promise<{ url: string; dir: string; prHead: string }> {
  const dir = await makeRepo()
  await runGit(dir, ["config", "uploadpack.allowFilter", "true"])

  await runGit(dir, ["switch", "--quiet", "-c", "contributor"])
  const prHead = await commit(dir, "app.ts", "change\n")
  await runGit(dir, ["update-ref", "refs/pull/1/head", prHead])
  await runGit(dir, ["switch", "--quiet", "main"])
  await runGit(dir, ["branch", "--quiet", "-D", "contributor"])

  return { url: `file://${dir}`, dir, prHead }
}

async function makeCacheDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codetrail-cache-"))
}

describe("cachePath", () => {
  test("gives the HTTPS and SSH URLs of one repo the same folder", () => {
    const https = cachePath("/cache", "https://github.com/acme/pay")
    expect(https).toBe("/cache/repos/github.com/acme/pay.git")
    expect(cachePath("/cache", "git@github.com:acme/pay.git")).toBe(https)
    expect(cachePath("/cache", "https://github.com/acme/pay.git/")).toBe(https)
  })

  test("keeps a port as part of the host", () => {
    expect(cachePath("/cache", "ssh://git@git.acme.test:2222/acme/pay.git")).toBe(
      "/cache/repos/git.acme.test:2222/acme/pay.git",
    )
  })
})

describe("cachedRepo", () => {
  test("clones once, as a partial bare clone", async () => {
    const remote = await makeRemote()
    const dir = await cachedRepo(await makeCacheDir(), remote.url)

    expect(await runGit(dir, ["rev-parse", "--is-bare-repository"])).toBe("true")
    expect(await runGit(dir, ["config", "remote.origin.partialclonefilter"])).toBe("blob:none")
    expect(await runGit(dir, ["rev-parse", "main"])).toBe(
      await runGit(remote.dir, ["rev-parse", "main"]),
    )
  })

  test("reuses the clone; fetching brings it up to date", async () => {
    const remote = await makeRemote()
    const cacheDir = await makeCacheDir()
    const dir = await cachedRepo(cacheDir, remote.url)
    const newer = await commit(remote.dir, "later.ts", "later\n")

    expect(await cachedRepo(cacheDir, remote.url)).toBe(dir)
    expect(await runGit(dir, ["rev-parse", "main"])).not.toBe(newer)

    await fetchRefs(dir)
    expect(await runGit(dir, ["rev-parse", "main"])).toBe(newer)
  })

  test("leaves nothing behind when the clone fails", async () => {
    const cacheDir = await makeCacheDir()
    const url = `file://${join(cacheDir, "missing")}`

    expect(await rejection(cachedRepo(cacheDir, url))).toBeInstanceOf(Error)
    expect(existsSync(cachePath(cacheDir, url))).toBe(false)
  })
})

describe("fetchRefs", () => {
  test("fetches a pull request's head through its ref", async () => {
    const remote = await makeRemote()
    const dir = await cachedRepo(await makeCacheDir(), remote.url)

    await fetchRefs(dir, ["refs/pull/1/head"])
    expect(await runGit(dir, ["rev-parse", "refs/pull/1/head"])).toBe(remote.prHead)
  })
})
