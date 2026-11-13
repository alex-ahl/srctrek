import { expect, test } from "bun:test"
import type { NextStop } from "@srctrek/core"
import { stopPageHtml } from "../src/stop-page"
import { ref, stepWith } from "./support/views"

const end: NextStop = { how: "end", to: null, line: null }
const noCode = () => []

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
  expect(html).toContain(
    '<p class="high">⚠ likely wrong · fixed</p><p class="muted">next: the end of the trek</p>',
  )
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

  const html = stopPageHtml(view, () => ["  send(total)"], "n")

  expect(html).toContain('From <a href="#" data-goto="s1">stop 1 · main · main.ts:1</a>')
  expect(html).toContain("guessed: matched by name")
  expect(html).toContain('data-line="2">main.ts:2</a> <code>send(total)</code>')
  expect(html).toContain('data-line="9">api: routes.ts:9</a>')
})

test("each piece of context shows its reason, where it is, and its code", () => {
  const view = stepWith([], end, {
    context: [{ ...ref, id: "s2a", name: "Refund", summary: "The shape a refund takes." }],
  })

  const html = stopPageHtml(view, () => ["type Refund = {", "  amount: number", "}"], "n")

  expect(html).toContain('<section id="context"><h3>Context</h3>')
  expect(html).toContain(
    '<p>The shape a refund takes.</p><p class="place"><a href="#" data-goto="s2a">Refund · main.ts:1</a></p>',
  )
  expect(html).toContain('<pre class="code">type Refund = {\n  amount: number\n}</pre>')
})

test("a long piece of context shows its start and says how much is left", () => {
  const view = stepWith([], end, { context: [{ ...ref, id: "s2a", start_line: 1, end_line: 45 }] })
  const asked: number[] = []

  const html = stopPageHtml(view, (range) => (asked.push(range.last), ["x"]), "n")

  expect(asked).toEqual([8])
  expect(html).toContain('<a href="#" data-goto="s2a">… 37 more lines</a>')
})

test("questions get their own block; values stay in the code", () => {
  const view = stepWith([], end, {
    predicted_values: [{ name: "pay", value: "250", line: 2, role: "return" }],
    notes: [{ question: "Why 250?", answer: "A placeholder." }],
  })

  const html = stopPageHtml(view, noCode, "n")

  expect(html).toContain('<p class="question">Why 250?</p><p>A placeholder.</p>')
  expect(html).not.toContain("≈")
})

test("with no stop open the page says how to start", () => {
  expect(stopPageHtml(null, noCode, "n")).toContain("No stop open. Run srctrek: Open Trek…")
})
