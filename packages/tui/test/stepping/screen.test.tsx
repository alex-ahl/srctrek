import { expect, mock, test } from "bun:test"
import { repoWithShowcase, repoWithSteps, repoWithTrek, repoWithTwoCalls } from "@srctrek/testing"
import type { PageActions } from "../../src/stepping/page"
import { SteppingScreen } from "../../src/stepping/screen"
import { type Screen, frameAfter } from "../support/keys"

type Input = Parameters<Parameters<typeof frameAfter>[1]>[0]

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
  const frame = await frameAfter(
    stepping(root),
    (_input, screen) => screen.shows(" stops"),
    120,
    30,
  )

  expect(frame).toContain("srctrek › Paying")
  expect(frame).toContain("3 stops")
  expect(frame).toContain("enter step here · ? keys")
})

test("enter on the page steps to the first stop", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressEnter()
      await screen.shows("1 / ")
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
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("e")
    },
    120,
    30,
  )

  expect(frame).toContain("enter step here · e step in Neovim · b update · l builds · ? keys")
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
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressEnter()
    },
    120,
    30,
  )

  expect(frame).toContain("enter step in Neovim · n step here")
  expect(open).toHaveBeenCalled()
})

test("n steps to the first step: its file, the narration over it, and where n and p go", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("const total = pay()")
    },
    120,
    30,
  )

  expect(frame).toContain("1 / 3")
  expect(frame).toMatch(/▌ +main calls pay/)
  expect(frame).toContain("NEXT  n")
  expect(frame).toMatch(/into pay /)
  expect(frame).toMatch(/PREVIOUS  p\s+.*\n.*the overview/)
  expect(frame).toMatch(/1 ▶ +const total = pay\(\) +→ \[n\] /)
  expect(frame).toContain("n into pay · p back · r route")
})

test("into, then out, follow the call and come back", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("1 / ")
      input.pressKey("i")
      await screen.shows("export function pay()")
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
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("const total = pay()")
      input.pressArrow("down")
      await screen.drawn()
      input.pressKey("i")
      await screen.shows("export function send(total)")
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
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("1 / ")
      input.pressKey("i")
      await screen.shows("2 / ")
      input.pressKey("d")
      await screen.shows("const total = pay()")
    },
    120,
    34,
  )

  expect(frame).toContain("REACHED FROM")
  expect(frame).toMatch(/› +stop 1/)
  expect(frame).toMatch(/main\.ts:1 [^\n]*\n +const total = pay\(\)/)
  expect(frame).toContain("CONTEXT")
  expect(frame).toContain("enter go there")
})

test("enter in details goes to the step chosen, closing them", async () => {
  const root = await repoWithTwoCalls()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("1 / ")
      input.pressKey("i")
      await screen.shows("2 / ")
      input.pressKey("d")
      await screen.shows("REACHED FROM")
      // past where it came from and the line its evidence cites, to its context
      input.pressArrow("down")
      await screen.drawn()
      input.pressArrow("down")
      await screen.drawn()
      input.pressEnter()
      await screen.shows("returns a fixed amount")
    },
    120,
    34,
  )

  expect(frame).toMatch(/▌ +returns a fixed amount/)
  expect(frame).not.toContain("REACHED FROM")
})

test("? at a stop lists every key, D among them for the change", async () => {
  const root = await repoWithTrek()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("1 / ")
      input.pressKey("?")
      await screen.shows("MOVE")
    },
    120,
    30,
  )

  expect(frame).toContain("MOVE")
  expect(frame).toMatch(/D +the change to the stop's file/)
  expect(frame).toMatch(/q +home/)
})

test("r opens the route: the call tree, what runs at ▶, and the chosen stop beside it", async () => {
  const root = await repoWithTwoCalls()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("1 / ")
      input.pressKey("n")
      await screen.shows("2 / ")
      input.pressKey("r")
      await screen.shows("RUNNING")
    },
    120,
    24,
  )

  expect(frame).toContain("the route · r back")
  expect(frame).toMatch(/running at ▶  main\.ts:1 › pay\.ts:1/)
  expect(frame).toMatch(/▶  2  │ pay\.ts:1/)
  expect(frame).toMatch(/n  3  │ send\.ts:1/)
  expect(frame).toMatch(/STOP 2  you're here/)
  expect(frame).toContain("RUNNING")
})

test("enter in the route goes to the stop chosen", async () => {
  const root = await repoWithTwoCalls()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("1 / ")
      input.pressKey("r")
      await screen.shows("RUNNING")
      input.pressArrow("down")
      await screen.drawn()
      input.pressArrow("down")
      await screen.drawn()
      input.pressEnter()
      await screen.shows("3 / ")
    },
    120,
    24,
  )

  expect(frame).toContain("3 / 3")
  expect(frame).not.toContain("RUNNING")
})

test("← in the route folds a call's stops into its row, and n then steps past them", async () => {
  const root = await repoWithTwoCalls()
  const steps = async (input: Input, screen: Screen) => {
    await screen.shows(" stops")
    input.pressKey("n")
    await screen.shows("1 / ")
    input.pressKey("r")
    await screen.shows("RUNNING")
    input.pressArrow("left")
    await screen.shows("2 stops")
  }
  const map = await frameAfter(stepping(root), steps, 120, 24)
  const after = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await steps(input, screen)
      input.pressKey("r")
      await screen.shows("the end of the trek")
    },
    120,
    24,
  )

  expect(map).toMatch(/▶  1  ▸ main\.ts:1  2 stops/)
  expect(map).not.toMatch(/│ pay\.ts:1/)
  expect(after).toContain("the end of the trek")
  expect(after).toContain("n the end · p back")
})

test("tab in the route lays the stops out by repo, then as a tree of their files", async () => {
  const root = await repoWithTwoCalls()
  const frame = await frameAfter(
    stepping(root),
    async (input, screen) => {
      await screen.shows(" stops")
      input.pressKey("n")
      await screen.shows("1 / ")
      input.pressKey("r")
      await screen.shows("RUNNING")
      input.pressTab()
      await screen.drawn()
      input.pressTab()
      await screen.shows("tab calls, repos, files")
    },
    120,
    24,
  )

  expect(frame).toMatch(/▶ +main\.ts +1 \+/)
  expect(frame).toMatch(/n +pay\.ts +2 \+/)
  expect(frame).toContain("tab calls, repos, files")
})

test("a hop says what carries it, beside the code and in the route", async () => {
  const root = await repoWithShowcase()
  const presses = async (input: Input, screen: Screen, keys: string[]) => {
    await screen.shows(" stops")
    // each n reaches the next stop, r the route
    for (const [i, key] of keys.entries()) {
      input.pressKey(key)
      await screen.shows(key === "n" ? `${String(i + 1)} / ` : "RUNNING")
    }
  }
  const stop = await frameAfter(
    stepping(root),
    (input, screen) => presses(input, screen, ["n", "n", "n", "n"]),
    120,
    24,
  )
  const map = await frameAfter(
    stepping(root),
    (input, screen) => presses(input, screen, ["n", "n", "n", "n", "r"]),
    120,
    24,
  )

  expect(stop).toContain("↯ on a queued event to onRefunded")
  expect(map).toMatch(/↯ onRefunded  on a queued event/)
})

test("enter on a call found by name in several places opens the nearest, and ←/→ the others", async () => {
  const root = await repoWithSteps(
    [
      ["vendor/format.ts", "export function format(n: number) {\n  return `${n}`\n}\n"],
      ["format.ts", "export function format(n: number) {\n  return n.toFixed(2)\n}\n"],
      ["main.ts", "const shown = format(250)\n"],
    ],
    ({ step }) => [step({ summary: "main formats the total" })],
  )
  const presses = async (input: Input, screen: Screen, more: boolean) => {
    await screen.shows(" stops")
    input.pressKey("n")
    await screen.shows("const shown = format(250)")
    input.pressEnter()
    await screen.shows("1 of 2")
    if (more) {
      input.pressArrow("right")
      await screen.shows("2 of 2")
    }
  }
  const first = await frameAfter(
    stepping(root),
    (input, screen) => presses(input, screen, false),
    120,
    24,
  )
  const second = await frameAfter(
    stepping(root),
    (input, screen) => presses(input, screen, true),
    120,
    24,
  )

  expect(first).toContain("format · format.ts:1 · found by name · 1 of 2")
  expect(first).toContain("←/→ other places")
  expect(second).toContain("format · vendor/format.ts:1 · found by name · 2 of 2")
})
