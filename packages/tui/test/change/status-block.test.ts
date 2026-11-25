import { expect, test } from "bun:test"
import { statusBlock } from "../../src/change/status-block"

test("a stale pull request's trek, its changed steps not counted, says its head moved on", () => {
  const block = statusBlock(
    { kind: "stale", name: "pr-12", staleStops: undefined, stops: 9 },
    false,
  )

  expect(block.details).toEqual(["built at an older head of the pull request"])
})
