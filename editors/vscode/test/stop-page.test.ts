import { expect, test } from "bun:test"
import type { NextStop } from "@codetrail/core"
import { stopPageHtml } from "../src/stop-page"
import { ref, stepWith } from "./support/views"

const end: NextStop = { how: "end", to: null, line: null }
const noCode = () => ""

test("the stack lists the newest frame first, links the older ones, and marks a hop", () => {
  const view = stepWith([], end, {
    stack: [
      { ...ref, id: "s1", name: "main", hop: false },
      { ...ref, id: "s4", name: "POST /refunds", hop: true },
    ],
    started_by: null,
  })

  const html = stopPageHtml(view, noCode, "n")

  expect(html.indexOf("POST /refunds")).toBeLessThan(html.indexOf("main ·"))
  expect(html).toContain('<li><span class="muted">↯ </span><b>POST /refunds · main.ts:1</b></li>')
  expect(html).toContain('<a href="#" data-goto="s1">main · main.ts:1</a>')
})

test("a stack started by a hop nobody waits on says what started it", () => {
  const view = stepWith([], end, {
    stack: [{ ...ref, id: "s5", name: "onRefunded", hop: true }],
    started_by: { ...ref, id: "s4", name: "publish" },
  })

  expect(stopPageHtml(view, noCode, "n")).toContain(
    'started by <a href="#" data-goto="s4">publish · main.ts:1</a>',
  )
})

test("where the stop came from shows each cited line with its code, and says when it's guessed", () => {
  const view = stepWith([], end, {
    came_from: {
      ...ref,
      id: "s1",
      name: "main",
      relation: "from",
      number: 1,
      guessed: true,
      cites: [{ repo: "app", file: "main.ts", line: 2, path: "/app/main.ts" }],
    },
  })

  const html = stopPageHtml(view, () => "send(total)", "n")

  expect(html).toContain('Reached from <a href="#" data-goto="s1">stop 1 · main · main.ts:1</a>')
  expect(html).toContain("(guessed: matched by name)")
  expect(html).toContain('data-open="/app/main.ts" data-line="2">app: main.ts:2</a>')
  expect(html).toContain("<code>send(total)</code>")
})

test("flag, values, context, details, and questions each get their section", () => {
  const view = stepWith([], end, {
    flag: { severity: "medium", note: "total may be <undefined>" },
    predicted_values: [{ name: "pay", value: "250", line: 2, role: "return", uncertain: true }],
    context: [{ ...ref, id: "s2a", name: "pay", summary: "returns a fixed amount" }],
    details: "Why it pays first.",
    notes: [{ question: "Why 250?", answer: "A placeholder." }],
  })

  const html = stopPageHtml(view, noCode, "n")

  expect(html).toContain('<p class="medium">● risky · total may be &lt;undefined&gt;</p>')
  expect(html).toContain("line 2: <code>returns ≈? 250</code>")
  expect(html).toContain('<a href="#" data-goto="s2a">pay · main.ts:1</a>: returns a fixed amount')
  expect(html).toContain("Why it pays first.")
  expect(html).toContain("<b>Q: Why 250?</b>")
})

test("with no stop open the page says how to start", () => {
  expect(stopPageHtml(null, noCode, "n")).toContain("No stop open. Run Codetrail: Open Tour…")
})
