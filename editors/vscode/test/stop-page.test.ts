import { expect, test } from "bun:test"
import type { NextStop } from "@codetrail/core"
import { stopPageHtml } from "../src/stop-page"
import { ref, stepWith } from "./support/views"

const end: NextStop = { how: "end", to: null, line: null }
const noCode = () => ""

test("the page opens with the narration, its details, then the flag and where next goes", () => {
  const view = stepWith([], end, {
    summary: "Pays <first>.",
    details: "Why it pays first.",
    flag: { severity: "high", note: "fixed" },
  })

  const html = stopPageHtml(view, noCode, "n")

  expect(html).toContain(
    '<section class="lead"><p>Pays &lt;first&gt;.</p><p class="details">Why it pays first.</p>',
  )
  expect(html).toContain('<span class="high">⚠ likely wrong · fixed</span>')
  expect(html).toContain('<span class="muted">next: the end of the tour</span>')
})

test("the stack lists the newest frame first, links the older ones, and marks a hop", () => {
  const view = stepWith([], end, {
    stack: [
      { ...ref, id: "s1", name: "main", hop: false },
      { ...ref, id: "s4", name: "POST /refunds", hop: true },
    ],
  })

  const html = stopPageHtml(view, noCode, "n")

  expect(html).toContain("<h3>Call stack</h3>")
  expect(html.indexOf("POST /refunds")).toBeLessThan(html.indexOf("main ·"))
  expect(html).toContain('<li><span class="muted">↯ </span>POST /refunds · main.ts:1</li>')
  expect(html).toContain('<a href="#" data-goto="s1">main · main.ts:1</a>')
})

test("a stack of the stop alone is left out; one started by a hop says what started it", () => {
  const alone = stepWith([], end, { stack: [{ ...ref, id: "s1", name: "main", hop: false }] })
  const started = stepWith([], end, {
    stack: [{ ...ref, id: "s5", name: "onRefunded", hop: true }],
    started_by: { ...ref, id: "s4", name: "publish" },
  })

  expect(stopPageHtml(alone, noCode, "n")).not.toContain("Call stack")
  expect(stopPageHtml(started, noCode, "n")).toContain(
    'started by <a href="#" data-goto="s4">publish · main.ts:1</a>',
  )
})

test("where the stop came from gives each cited line with its code, and says when it's guessed", () => {
  const view = stepWith([], end, {
    came_from: {
      ...ref,
      id: "s1",
      name: "main",
      relation: "from",
      number: 1,
      guessed: true,
      cites: [
        { repo: "app", file: "main.ts", line: 2, path: "/app/main.ts" },
        { repo: "api", file: "routes.ts", line: 9, path: "/api/routes.ts" },
      ],
    },
  })

  const html = stopPageHtml(view, () => "send(total)", "n")

  expect(html).toContain('From <a href="#" data-goto="s1">stop 1 · main · main.ts:1</a>')
  expect(html).toContain("guessed: matched by name")
  expect(html).toContain('data-line="2">main.ts:2</a> <code>send(total)</code>')
  expect(html).toContain('data-line="9">api: routes.ts:9</a>')
})

test("context and questions get their own blocks; values stay in the code", () => {
  const view = stepWith([], end, {
    predicted_values: [{ name: "pay", value: "250", line: 2, role: "return" }],
    context: [{ ...ref, id: "s2a", name: "pay", summary: "returns a fixed amount" }],
    notes: [{ question: "Why 250?", answer: "A placeholder." }],
  })

  const html = stopPageHtml(view, noCode, "n")

  expect(html).toContain('<a href="#" data-goto="s2a">pay · main.ts:1</a>')
  expect(html).toContain('<p class="question">Why 250?</p><p>A placeholder.</p>')
  expect(html).not.toContain("≈")
})

test("with no stop open the page says how to start", () => {
  expect(stopPageHtml(null, noCode, "n")).toContain("No stop open. Run Codetrail: Open Tour…")
})
