import { expect, mock, test } from "bun:test"
import { repoWithTrek, repoWithTwoCalls } from "@srctrek/testing"
import type { PageActions } from "../../src/stepping/page"
import { SteppingScreen } from "../../src/stepping/screen"
import { frameAfter } from "../support/keys"

const settle = () => Bun.sleep(300)

const HERE: PageActions = {
  editor: undefined,
  editorFirst: false,
  build: undefined,
  stop: undefined,
  builds: undefined,
}

function stepping(root: string, page: PageActions = HERE) {
  return (
    <SteppingScreen
      root={root}
      name="pay"
      title="Paying"
      editor={undefined}
      page={page}
      onBack={() => undefined}
      tint={undefined}
    />
  )
}

test("opens a trek at its page: the overview, and enter to step it here", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(stepping(root), settle, 120, 30)

  expect(frame).toContain("srctrek › Paying")
  expect(frame).toContain("3 stops")
  expect(frame).toContain("enter step here · q home")
})

test("enter on the page steps to the first stop", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    stepping(root),
    async (input) => {
      await settle()
      input.pressEnter()
      await settle()
    },
    120,
    30,
  )

  expect(frame).toContain("1 / 3")
})

test("the page offers the editor, a build, and the builds; e opens the editor", async () => {
  const root = await repoWithTrek()
  const open = mock(() => undefined)
  const page: PageActions = {
    ...HERE,
    editor: { label: "step in Neovim", open },
    build: { verb: "update", run: () => undefined },
    builds: () => undefined,
  }
  const frame = await frameAfter(
    stepping(root, page),
    async (input) => {
      await settle()
      input.pressKey("e")
    },
    120,
    30,
  )

  expect(frame).toContain("enter step here · e step in Neovim · b update · l builds · q home")
  expect(open).toHaveBeenCalled()
})

test("with an editor chosen, enter on the page opens it and n steps here", async () => {
  const root = await repoWithTrek()
  const open = mock(() => undefined)
  const page: PageActions = {
    ...HERE,
    editor: { label: "step in Neovim", open },
    editorFirst: true,
  }
  const frame = await frameAfter(
    stepping(root, page),
    async (input) => {
      await settle()
      input.pressEnter()
    },
    120,
    30,
  )

  expect(frame).toContain("enter step in Neovim · n step here")
  expect(open).toHaveBeenCalled()
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

test("the cursor marks its line, and i steps into the call made on it", async () => {
  const root = await repoWithTwoCalls()
  const frame = await frameAfter(
    stepping(root),
    async (input) => {
      await settle()
      input.pressKey("n")
      await settle()
      input.pressArrow("down")
      await settle()
      input.pressKey("i")
      await settle()
    },
    120,
    30,
  )

  expect(frame).toContain("send.ts:1")
  expect(frame).toMatch(/›\s+1 ▶ +export function send\(total\)/)
})

test("d opens a step's details: how it was reached, with the cited line's code, and its context", async () => {
  const root = await repoWithTwoCalls()
  const frame = await frameAfter(
    stepping(root),
    async (input) => {
      await settle()
      input.pressKey("n")
      await settle()
      input.pressKey("i")
      await settle()
      input.pressKey("d")
      await settle()
    },
    120,
    34,
  )

  expect(frame).toContain("REACHED FROM")
  expect(frame).toMatch(/› +stop 1/)
  expect(frame).toMatch(/main\.ts:1\s+const total = pay\(\)/)
  expect(frame).toContain("CONTEXT")
  expect(frame).toContain("enter go there")
})

test("enter in details goes to the step chosen, closing them", async () => {
  const root = await repoWithTwoCalls()
  const frame = await frameAfter(
    stepping(root),
    async (input) => {
      await settle()
      input.pressKey("n")
      await settle()
      input.pressKey("i")
      await settle()
      input.pressKey("d")
      await settle()
      // past where it came from and the line its evidence cites, to its context
      input.pressArrow("down")
      await settle()
      input.pressArrow("down")
      await settle()
      input.pressEnter()
      await settle()
    },
    120,
    34,
  )

  expect(frame).toMatch(/▌ +returns a fixed amount/)
  expect(frame).not.toContain("REACHED FROM")
})
