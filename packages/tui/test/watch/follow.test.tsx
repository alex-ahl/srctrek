import { expect, mock, test } from "bun:test"
import { useEffect, useState } from "react"
import type { ChangeChoice } from "@srctrek/core"
import { type Stamp, useFollow } from "../../src/watch/follow"
import { pressOn } from "../support/keys"

const picked: ChangeChoice = { kind: "branch", name: "fix/rounding" }

function Following(props: { stamp: Stamp; onMoved: () => Promise<void> }) {
  useFollow(props.stamp, picked, props.onMoved)
  return <text>following</text>
}

test("says the chosen change moved once its stamp moves, and not before", async () => {
  const stamps = ["one", "one", "two"]
  const onMoved = mock(() => Promise.resolve())
  const stamp = mock((_choice: ChangeChoice) => Promise.resolve(stamps.shift() ?? "two"))

  await pressOn(<Following stamp={stamp} onMoved={onMoved} />, async () => {
    await Bun.sleep(100)
    expect(onMoved).not.toHaveBeenCalled()
    // the first check is at once, then one every two seconds
    await Bun.sleep(4200)
  })

  expect(onMoved).toHaveBeenCalledTimes(1)
  expect(stamp).toHaveBeenCalledWith(picked)
})

// Picks `next` a moment after it starts, as the landing page would.
function PickingLater(props: { stamp: Stamp; next: ChangeChoice; onMoved: () => Promise<void> }) {
  const [choice, setChoice] = useState(picked)
  useEffect(() => {
    const timer = setTimeout(() => setChoice(props.next), 1000)
    return () => clearTimeout(timer)
  }, [props.next])
  useFollow(props.stamp, choice, props.onMoved)
  return <text>following</text>
}

test("takes a new choice's first stamp without saying it moved, as picking opened it", async () => {
  const ticked: ChangeChoice = { ...picked, repos: [{ path: "../api", changed: true }] }
  // the ticked repo's head joins the stamp, which moves it
  const stamp = (choice: ChangeChoice) => Promise.resolve(choice.repos ? "one+api" : "one")
  const onMoved = mock(() => Promise.resolve())

  await pressOn(<PickingLater stamp={stamp} next={ticked} onMoved={onMoved} />, () =>
    Bun.sleep(4200),
  )

  expect(onMoved).not.toHaveBeenCalled()
})

test("a move that can't be taken in is left until the stamp moves again", async () => {
  const stamps = ["one", "two"]
  const onMoved = mock(() => Promise.reject(new Error("no base branch")))
  const stamp = () => Promise.resolve(stamps.shift() ?? "two")

  await pressOn(<Following stamp={stamp} onMoved={onMoved} />, () => Bun.sleep(4200))

  expect(onMoved).toHaveBeenCalledTimes(1)
})
