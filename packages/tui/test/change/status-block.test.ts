import { expect, test } from "bun:test"
import { statusBlock } from "../../src/change/status-block"

test("a stale pull request's trek, its changed steps not counted, says its head moved on", () => {
  const block = statusBlock(
    { kind: "stale", name: "pr-12", staleStops: undefined, stops: 9 },
    false,
  )

  expect(block.details).toEqual(["built at an older head of the pull request"])
})

test("a trek built by a newer trek says to restart this one", () => {
  const block = statusBlock({ kind: "newer-guide", name: "feat-receipt-email" }, true)

  expect(block.state).toBe("newer guide")
  expect(block.details).toEqual(["built by a newer trek: restart trek to see it"])
})
