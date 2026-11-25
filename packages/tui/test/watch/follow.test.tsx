import { expect, mock, test } from "bun:test"
import { useEffect, useState } from "react"
import type { ChangeChoice } from "@srctrek/core"
import { type Stamp, useFollow } from "../../src/watch/follow"
import { deferred } from "../support/deferred"
import { pressOn } from "../support/keys"

const picked: ChangeChoice = { kind: "branch", name: "fix/rounding" }

// Checks every few ms, so a test waits on the checks it needs rather than on the clock.
const EVERY_MS = 5

// A stamp answering `answer`, and a wait for the check that asks it the `times`th time.
function counted(answer: (choice: ChangeChoice, call: number) => string) {
  let calls = 0
  const waits = new Map<number, ReturnType<typeof deferred<undefined>>>()
  const asked = (times: number) => {
    const wait = waits.get(times) ?? deferred<undefined>()
    waits.set(times, wait)
    if (calls >= times) {
      wait.resolve(undefined)
    }
    return wait.promise
  }
  const stamp = mock((choice: ChangeChoice) => {
    calls += 1
    const stamped = answer(choice, calls)
    waits.get(calls)?.resolve(undefined)
    return Promise.resolve(stamped)
  })

  return { stamp, asked }
}

function Following(props: { stamp: Stamp; onMoved: () => Promise<void> }) {
  useFollow(props.stamp, picked, props.onMoved, EVERY_MS)
  return <text>following</text>
}

test("says the chosen change moved once its stamp moves, and not before", async () => {
  const onMoved = mock(() => Promise.resolve())
  const { stamp, asked } = counted((_choice, call) => (call < 3 ? "one" : "two"))

  await pressOn(<Following stamp={stamp} onMoved={onMoved} />, async () => {
    await asked(2)
    expect(onMoved).not.toHaveBeenCalled()
    // the check after the move, which comes once the move is taken in
    await asked(4)
  })

  expect(onMoved).toHaveBeenCalledTimes(1)
  expect(stamp).toHaveBeenCalledWith(picked)
})

// Picks `next` once `pick` settles, as the landing page would.
function PickingLater(props: {
  stamp: Stamp
  next: ChangeChoice
  pick: Promise<undefined>
  onMoved: () => Promise<void>
}) {
  const [choice, setChoice] = useState(picked)
  useEffect(() => {
    void props.pick.then(() => setChoice(props.next))
  }, [props.pick, props.next])
  useFollow(props.stamp, choice, props.onMoved, EVERY_MS)
  return <text>following</text>
}

test("takes a new choice's first stamp without saying it moved, as picking opened it", async () => {
  const ticked: ChangeChoice = { ...picked, repos: [{ path: "../api", changed: true }] }
  // the ticked repo's head joins the stamp, which moves it
  const { stamp, asked } = counted((choice) => (choice.repos ? "one+api" : "one"))
  const onMoved = mock(() => Promise.resolve())
  const pick = asked(2)

  await pressOn(
    <PickingLater stamp={stamp} next={ticked} pick={pick} onMoved={onMoved} />,
    async () => {
      await pick
      // the new choice's first stamp and one after it
      await asked(6)
    },
  )

  expect(stamp).toHaveBeenCalledWith(ticked)
  expect(onMoved).not.toHaveBeenCalled()
})

test("a move that can't be taken in is left until the stamp moves again", async () => {
  const onMoved = mock(() => Promise.reject(new Error("no base branch")))
  const { stamp, asked } = counted((_choice, call) => (call === 1 ? "one" : "two"))

  await pressOn(<Following stamp={stamp} onMoved={onMoved} />, () => asked(5))

  expect(onMoved).toHaveBeenCalledTimes(1)
})
