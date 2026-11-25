import { afterEach, describe, expect, test } from "bun:test"
import { chmod, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { NO_PROMPT, runGit } from "../../src/git/run"
import { makeRepo, tempDir } from "@srctrek/testing"

const PRINT_GROUP = `perl -e 'print getpgrp'`

async function ownProcessGroup(): Promise<string> {
  const proc = Bun.spawn(["sh", "-c", PRINT_GROUP], { stdout: "pipe" })
  return new Response(proc.stdout).text()
}

const sshCommand = process.env.GIT_SSH_COMMAND

afterEach(() => {
  if (sshCommand === undefined) {
    delete process.env.GIT_SSH_COMMAND
  } else {
    process.env.GIT_SSH_COMMAND = sshCommand
  }
})

describe("runGit with NO_PROMPT", () => {
  // A login that asks on the terminal itself, as ssh does, skips git's prompt settings; outside
  // trek's process group it has no terminal to ask on.
  test("runs git outside trek's process group", async () => {
    const repo = await makeRepo()
    const dir = await tempDir("ssh-")
    const seen = join(dir, "group")
    const ssh = join(dir, "ssh")
    await writeFile(ssh, `#!/bin/sh\n${PRINT_GROUP} > "${seen}"\nexit 1\n`)
    await chmod(ssh, 0o755)
    process.env.GIT_SSH_COMMAND = ssh

    await runGit(repo, ["ls-remote", "ssh://example.invalid/repo"], NO_PROMPT).catch(() => "")

    expect(await readFile(seen, "utf8")).not.toBe(await ownProcessGroup())
  })
})
