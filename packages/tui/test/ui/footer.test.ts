import { expect, test } from "bun:test"
import { fittingKeys } from "../../src/ui/footer"

const keys = [
  { key: "enter", does: "open" },
  { key: "a", does: "add repos" },
  { key: "p", does: "28 pull requests" },
  { key: "?", does: "keys" },
]

test("keys that fit the line are all kept", () => {
  expect(fittingKeys(keys, 80)).toEqual(keys)
})

test("past the line's width, keys are given up from the end, the last one kept", () => {
  // "↵: open  ¦  a: add repos  ¦  ?: keys" is 36 wide
  expect(fittingKeys(keys, 40).map((hint) => hint.key)).toEqual(["enter", "a", "?"])
  expect(fittingKeys(keys, 10).map((hint) => hint.key)).toEqual(["?"])
})
