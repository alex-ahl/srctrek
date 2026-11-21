import { expect, test } from "bun:test"
import { valueMarks } from "../../src/code/value-marks"
import { stepWith } from "../support/views"

const end = {
  how: "end",
  to: null,
  line: null,
  through: null,
  text: "next: the end of the trek",
} as const

test("values read name ≈ value, a return as returns, a doubtful one as ≈?", () => {
  const view = stepWith([], end, {
    predicted_values: [
      { name: "total", value: "250", line: 2, role: "assignment" },
      { name: "pay", value: "250", line: 3, role: "return", uncertain: true },
    ],
  })

  expect(valueMarks(view)).toEqual([
    { line: 1, text: "total ≈ 250", doubtful: false, first: true },
    { line: 2, text: "returns ≈? 250", doubtful: true, first: true },
  ])
})

test("later values on a line follow a comma, and a long value is cut", () => {
  const view = stepWith([], end, {
    predicted_values: [
      { name: "a", value: "1", line: 1, role: "argument" },
      { name: "b", value: "x".repeat(50), line: 1, role: "argument" },
    ],
  })

  expect(valueMarks(view).map((mark) => mark.text)).toEqual(["a ≈ 1", `, b ≈ ${"x".repeat(39)}…`])
})
