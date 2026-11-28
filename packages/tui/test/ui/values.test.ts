import { expect, test } from "bun:test"
import { MOST_LINES, capped, wrapValues } from "../../src/ui/values"

const texts = (lines: { text: string }[][]) =>
  lines.map((line) => line.map((part) => part.text).join(""))

test("starts a new line at each ↵, each value still in its tone", () => {
  const lines = wrapValues("The string «To: ana» ↵ Subject: «Your receipt» ↵ ↵ «2» × Mug", 40)

  expect(texts(lines)).toEqual(["The string To: ana", "Subject: Your receipt", "", "2 × Mug"])
  expect(lines[1]).toEqual([
    { text: "Subject: ", value: false },
    { text: "Your receipt", value: true },
  ])
})

test("keeps a long text to the most lines, the last saying how many more", () => {
  const lines = Array.from({ length: 30 }, (_, at) => at)
  const { shown, more } = capped(lines)

  expect(shown).toHaveLength(MOST_LINES - 1)
  expect(more).toBe(30 - (MOST_LINES - 1))
  expect(capped(lines.slice(0, MOST_LINES))).toEqual({ shown: lines.slice(0, MOST_LINES), more: 0 })
})
