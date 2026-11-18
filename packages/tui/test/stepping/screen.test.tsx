import { expect, test } from "bun:test"
import { repoWithTrek } from "@srctrek/testing"
import { SteppingScreen } from "../../src/stepping/screen"
import { frameAfter } from "../support/keys"

const settle = () => Bun.sleep(300)

function stepping(root: string) {
  return (
    <SteppingScreen
      root={root}
      name="pay"
      title="Paying"
      onBack={() => undefined}
      tint={undefined}
    />
  )
}

test("opens a trek at its overview, with how to start", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(stepping(root), settle, 120, 30)

  expect(frame).toContain("srctrek › Paying")
  expect(frame).toContain("3 stops · n to start")
})

test("n steps to the first step: its file, the narration over it, and where next goes", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    stepping(root),
    async (input) => {
      await settle()
      input.pressKey("n")
      await settle()
    },
    120,
    30,
  )

  expect(frame).toContain("1 / 3")
  expect(frame).toMatch(/▌ +main calls pay/)
  expect(frame).toMatch(/▌ +next: into pay, line 1/)
  expect(frame).toMatch(/1 ▶ +const total = pay\(\)/)
  expect(frame).toContain("CALL STACK")
})

test("into, then out, follow the call and come back", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    stepping(root),
    async (input) => {
      await settle()
      input.pressKey("n")
      await settle()
      input.pressKey("i")
      await settle()
    },
    120,
    30,
  )

  expect(frame).toContain("2 / 3")
  expect(frame).toMatch(/export function pay\(\)/)
  expect(frame).toMatch(/returns ≈/)
})
