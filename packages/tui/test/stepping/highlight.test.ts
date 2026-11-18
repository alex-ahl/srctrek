import { expect, test } from "bun:test"
import { fittedSpans, spansOf } from "../../src/stepping/highlight"

test("splits a file into lines of runs, a later highlight over an earlier one", () => {
  const text = "const pay = 1\n// paid\n"
  const highlights = [
    [0, 5, "keyword"],
    [6, 9, "variable"],
    [6, 9, "function"],
    [12, 13, "number"],
    [14, 21, "comment"],
  ] as const

  expect(spansOf(text, highlights)).toEqual([
    [
      { text: "const", tone: "busy", italic: false },
      { text: " ", tone: undefined, italic: false },
      { text: "pay", tone: "accent", italic: false },
      { text: " = ", tone: undefined, italic: false },
      { text: "1", tone: "bad", italic: false },
    ],
    [{ text: "// paid", tone: "dim", italic: true }],
    [],
  ])
})

test("cuts runs to a width, the last one with an ellipsis, tabs as two spaces", () => {
  const spans = [
    { text: "\tconst", tone: "busy" as const, italic: false },
    { text: " amount = 499", tone: undefined, italic: false },
  ]

  expect(fittedSpans(spans, 12).map((span) => span.text)).toEqual(["  const", " amo…"])
})
