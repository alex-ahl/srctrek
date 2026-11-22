import { expect, test } from "bun:test"
import { type ChangeChoice, GitError } from "@srctrek/core"
import { type Pending, PendingScreen, choiceName, failureReason } from "../src/opening"
import { frameAfter } from "./support/keys"

const pull: ChangeChoice = { kind: "pull-request", url: "https://github.com/acme/web/pull/12" }

const pendingWith = (pending: Pending) =>
  frameAfter(<PendingScreen pending={pending} onBack={() => undefined} />, () => undefined)

test("names a choice in a few words", () => {
  expect(choiceName({ kind: "own", uncommitted: false })).toBe("your branch")
  expect(choiceName({ kind: "own", uncommitted: true })).toBe("your branch with uncommitted work")
  expect(choiceName({ kind: "branch", name: "fix/rounding" })).toBe("fix/rounding")
  expect(choiceName(pull)).toBe("pr 12")
})

test("says a picked change is opening, and why it couldn't be opened", async () => {
  const opening = await pendingWith({ kind: "opening", choice: pull })
  const failed = await pendingWith({
    kind: "failed",
    choice: pull,
    why: "could not fetch refs/pull/12/head",
  })

  expect(opening).toContain("◐ opening pr 12…")
  expect(failed).toContain("✕ couldn't open pr 12: could not fetch refs/pull/12/head")
})

test("gives what git said last as the reason, not the command it ran", () => {
  const stderr =
    "Cloning into bare repository...\nfatal: could not read Username for 'https://github.com': terminal prompts disabled\n"
  const error = new GitError(["clone", "--bare", "https://github.com/acme/web"], stderr, 128)

  expect(failureReason(error)).toBe(
    "could not read Username for 'https://github.com': terminal prompts disabled",
  )
  expect(failureReason(new Error("no base branch"))).toBe("no base branch")
})
