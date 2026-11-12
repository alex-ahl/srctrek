import { expect, mock, test } from "bun:test"
import type { TrekStatus } from "@srctrek/core"
import { type FollowChange, useFollow } from "../src/follow"
import type { HomeChange } from "../src/home"
import { pressOn } from "./support/keys"

const summary = { changed: [], unchanged: [], code: false }
const empty: TrekStatus = { kind: "empty", name: "feature-refunds" }
const reopened: HomeChange = { summary, status: () => Promise.resolve(empty) }

function Following({ follow, onMoved }: { follow: FollowChange; onMoved: () => Promise<void> }) {
  useFollow(follow, onMoved)
  return <text>following</text>
}

test("reopens the change once its stamp moves, and not before", async () => {
  const stamps = ["one", "one", "two"]
  const reopen = mock(() => Promise.resolve(reopened))
  const onMoved = mock(() => Promise.resolve())
  const follow = { stamp: () => Promise.resolve(stamps.shift() ?? "two"), reopen }

  await pressOn(<Following follow={follow} onMoved={onMoved} />, async () => {
    await Bun.sleep(100)
    expect(reopen).not.toHaveBeenCalled()
    // the first check is at once, then one every two seconds
    await Bun.sleep(4200)
  })

  expect(reopen).toHaveBeenCalledTimes(1)
  expect(onMoved).toHaveBeenCalledWith(reopened)
})

test("keeps the last change when it can't be worked out, without retrying until it moves", async () => {
  const stamps = ["one", "two"]
  const reopen = mock(() => Promise.reject(new Error("no base branch")))
  const onMoved = mock(() => Promise.resolve())
  const follow = { stamp: () => Promise.resolve(stamps.shift() ?? "two"), reopen }

  await pressOn(<Following follow={follow} onMoved={onMoved} />, () => Bun.sleep(4200))

  expect(reopen).toHaveBeenCalledTimes(1)
  expect(onMoved).not.toHaveBeenCalled()
})
