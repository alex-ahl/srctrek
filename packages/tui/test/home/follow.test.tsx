import { expect, mock, test } from "bun:test"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { type FollowChange, useFollow } from "../../src/home/follow"
import type { HomeChange } from "../../src/home/home"
import { pressOn } from "../support/keys"

const summary = { changed: [], unchanged: [], code: false }
const empty: TrekStatus = { kind: "empty", name: "feature-refunds" }
const reopened: HomeChange = { summary, status: () => Promise.resolve(empty) }

const picked: ChangeChoice = { kind: "branch", name: "fix/rounding" }

function Following({ follow, onMoved }: { follow: FollowChange; onMoved: () => Promise<void> }) {
  useFollow(follow, follow.choice, onMoved)
  return <text>following</text>
}

test("reopens the chosen change once its stamp moves, and not before", async () => {
  const stamps = ["one", "one", "two"]
  const open = mock((_args: string[]) => Promise.resolve(reopened))
  const onMoved = mock(() => Promise.resolve())
  const follow = { choice: picked, stamp: () => Promise.resolve(stamps.shift() ?? "two"), open }

  await pressOn(<Following follow={follow} onMoved={onMoved} />, async () => {
    await Bun.sleep(100)
    expect(open).not.toHaveBeenCalled()
    // the first check is at once, then one every two seconds
    await Bun.sleep(4200)
  })

  expect(open).toHaveBeenCalledTimes(1)
  expect(open).toHaveBeenCalledWith(["...fix/rounding"])
  expect(onMoved).toHaveBeenCalledWith(reopened)
})

test("keeps the last change when it can't be worked out, without retrying until it moves", async () => {
  const stamps = ["one", "two"]
  const open = mock((_args: string[]) => Promise.reject(new Error("no base branch")))
  const onMoved = mock(() => Promise.resolve())
  const follow = { choice: picked, stamp: () => Promise.resolve(stamps.shift() ?? "two"), open }

  await pressOn(<Following follow={follow} onMoved={onMoved} />, () => Bun.sleep(4200))

  expect(open).toHaveBeenCalledTimes(1)
  expect(onMoved).not.toHaveBeenCalled()
})
