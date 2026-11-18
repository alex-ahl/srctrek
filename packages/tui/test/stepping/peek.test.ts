import { expect, test } from "bun:test"
import { commit, makeRepo } from "@srctrek/testing"
import { calledOn, definitionsOf } from "../../src/stepping/peek"

test("names the function a line calls, past keywords that take parentheses", () => {
  expect(calledOn("  if (ok) return await charge(order, -amount)")).toBe("charge")
  expect(calledOn("const total = 250")).toBeUndefined()
})

test("finds where a name is defined: a function, a declared name, a method", async () => {
  const dir = await makeRepo()
  await commit(dir, "pay.ts", "export function charge(n: number) {}\n")
  await commit(dir, "refund.ts", "export const refund: Handler = async () => {}\n")
  await commit(dir, "calls.ts", "charge(1)\nconst refunded = refund()\n")

  expect((await definitionsOf(dir, "charge")).map((look) => look.label)).toEqual([
    "charge · pay.ts:1",
  ])
  expect((await definitionsOf(dir, "refund")).map((look) => look.label)).toEqual([
    "refund · refund.ts:1",
  ])
})
