import { expect, test } from "bun:test"
import type { EndView, OverviewView } from "@srctrek/core"
import { escapeHtml } from "../../src/pages/page"
import { trekPageHtml } from "../../src/pages/trek"
import { ref } from "../support/views"

const overview: OverviewView = {
  kind: "overview",
  title: "Refund <an> order",
  overview: "The route refunds & records it.",
  trigger: { kind: "request", input: "POST /refunds" },
  outcome: "201 with the refund",
  count: 4,
  repos: ["api", "web"],
  flags: { high: 1, medium: 0, low: 2 },
  likely_wrong: [],
}

const end: EndView = {
  kind: "end",
  title: "Refund an order",
  outcome: "201 with the refund",
  count: 4,
  flags: [
    {
      ...ref,
      id: "s3",
      file: "src/routes/refund.ts",
      start_line: 11,
      name: "refund",
      number: 3,
      severity: "high",
      note: "amount unchecked",
    },
  ],
}

test("the overview tells the story, its trigger and outcome, repos, flags, and the keys", () => {
  const html = trekPageHtml(overview, "n0nce")

  expect(html).toContain("<h1>Refund &lt;an&gt; order</h1>")
  expect(html).toContain("The route refunds &amp; records it.")
  expect(html).toContain("<td>request · POST /refunds</td>")
  expect(html).toContain("<td>api, web</td>")
  expect(html).toContain("<td>1 likely wrong · 2 worth knowing</td>")
  expect(html).toContain("<kbd>F8</kbd>")
  expect(html).toContain("4 stops · srctrek: Next Stop (F8 by default) to start")
})

test("the example's values, marked in the trek, read without their markers", () => {
  const marked: OverviewView = {
    ...overview,
    trigger: { kind: "request", input: "POST /refunds with «40»" },
    outcome: "a row of «4000» cents",
  }
  const html = trekPageHtml(marked, "n0nce")

  expect(html).toContain("<td>request · POST /refunds with 40</td>")
  expect(html).toContain("<td>a row of 4000 cents</td>")
  expect(html).not.toMatch(/[«»]/)
})

test("the overview says once what the trek draws in the code", () => {
  const html = trekPageHtml(overview, "n0nce")

  expect(html).toContain(
    '<th><span class="bar added"></span></th><td>a line this change added</td>',
  )
  expect(html).toContain("a predicted value, worked out from the code, not run")
  expect(html).toContain("a call next can step into; →? when the link is guessed")
})

test("the end lists each flag as a link to its stop", () => {
  const html = trekPageHtml(end, "n0nce")

  expect(html).toContain(
    '<a href="#" data-goto="s3">⚠ likely wrong · 3 · routes/refund.ts:11 · refund</a>',
  )
  expect(html).toContain("<div>amount unchecked</div>")
})

test("only the page's own script may run", () => {
  const html = trekPageHtml(end, "n0nce")

  expect(html).toContain("script-src 'nonce-n0nce'")
  expect(html).toContain('<script nonce="n0nce">')
})

test("text is escaped before it reaches the page", () => {
  expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;")
})
