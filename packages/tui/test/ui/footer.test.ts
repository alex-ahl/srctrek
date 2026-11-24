import { expect, test } from "bun:test"
import { keysText } from "../../src/ui/footer"

test("keys read as the key, then what it does, spaced apart, enter drawn as ↵", () => {
  const text = keysText([
    { key: "enter", does: "open" },
    { key: "a", does: "add repos" },
    { key: "?", does: "keys" },
  ])

  expect(text).toBe("↵ open  ¦  a add repos  ¦  ? keys")
})
