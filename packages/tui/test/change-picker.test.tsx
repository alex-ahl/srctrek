import { expect, mock, test } from "bun:test"
import type { BranchChoices, ChangeChoice, OpenPullRequest, TrekStatus } from "@srctrek/core"
import { App } from "../src/app"
import { pickerRows, pullRequestRows } from "../src/change-picker-rows"
import { frameAfter } from "./support/keys"

const choices: BranchChoices = {
  base: "main",
  own: { name: "feature/refunds", commits: 3 },
  uncommittedFiles: 2,
  others: [
    { name: "fix/rounding", commits: 1 },
    { name: "feature/partial-refunds", commits: 5 },
  ],
}

const own: ChangeChoice = { kind: "own", uncommitted: false }

// The user's own branch has a trek; fix/rounding has none; the rest haven't answered yet.
function statusOf(choice: ChangeChoice): Promise<TrekStatus> {
  if (choice.kind === "own" && !choice.uncommitted) {
    return Promise.resolve({ kind: "ready", name: "feature-refunds" })
  }

  const none: TrekStatus = { kind: "missing", name: "fix-rounding" }
  return choice.kind === "branch" && choice.name === "fix/rounding"
    ? Promise.resolve(none)
    : new Promise(() => undefined)
}

const open: OpenPullRequest[] = [
  {
    number: 12,
    title: "Add partial refunds",
    author: "alice",
    url: "https://github.com/acme/web/pull/12",
    draft: false,
    reviewRequested: true,
  },
  {
    number: 14,
    title: "Round refunds to cents",
    author: "bo",
    url: "https://github.com/acme/web/pull/14",
    draft: true,
    reviewRequested: false,
  },
]

function app(
  onPick: (choice: ChangeChoice) => void,
  pullRequests: () => Promise<OpenPullRequest[]> = () => Promise.resolve(open),
) {
  const choosing = {
    choice: own,
    load: () => Promise.resolve(choices),
    pullRequests,
    status: statusOf,
    onPick,
  }
  return <App entries={[]} onOpen={() => undefined} onQuit={() => undefined} choosing={choosing} />
}

const openPicker = async (input: {
  pressKey: (key: string, mods?: { shift: boolean }) => void
}) => {
  input.pressKey("C", { shift: true })
  await Bun.sleep(30)
}

test("offers the user's own work first, then the other branches, each saying what it opens", () => {
  const rows = pickerRows(choices)

  expect(rows.map((row) => [row.group, row.label, row.detail])).toEqual([
    ["YOUR WORK", "feature/refunds", "3 commits since main"],
    ["YOUR WORK", "with uncommitted work", "2 files changed"],
    ["OTHER BRANCHES", "fix/rounding", "1 commit since main"],
    ["OTHER BRANCHES", "feature/partial-refunds", "5 commits since main"],
  ])
  expect(rows[1]?.opens).toBe("feature/refunds with 2 files not yet committed")
})

test("leaves out the uncommitted row when everything is committed", () => {
  const labels = pickerRows({ ...choices, uncommittedFiles: 0 }).map((row) => row.label)

  expect(labels).not.toContain("with uncommitted work")
})

test("C opens the picker on the user's own branch, marking the change chosen now", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    openPicker,
  )

  expect(frame).toContain("srctrek › change")
  expect(frame).toContain("YOUR WORK")
  expect(frame).toMatch(/● feature\/refunds +3 commits since main/)
  expect(frame).toContain("OTHER BRANCHES")
  expect(frame).toContain("Opens: feature/refunds · 3 commits since main")
  expect(frame).toContain("enter review this · esc keep current")
})

test("enter picks the selected change", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  await frameAfter(app(onPick), async (input) => {
    await openPicker(input)
    input.pressKey("j")
    input.pressKey("j")
    await Bun.sleep(20)
    input.pressEnter()
    await Bun.sleep(20)
  })

  expect(onPick).toHaveBeenCalledWith({ kind: "branch", name: "fix/rounding" })
})

test("esc keeps the current change and goes back to the list", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  const frame = await frameAfter(app(onPick), async (input) => {
    await openPicker(input)
    input.pressEscape()
    await Bun.sleep(20)
  })

  expect(onPick).not.toHaveBeenCalled()
  expect(frame).not.toContain("srctrek › change")
  expect(frame).toContain("C change")
})

test("says on each row whether a trek of it exists, as each is worked out", async () => {
  const frame = await frameAfter(
    app(() => undefined),
    openPicker,
  )

  expect(frame).toMatch(/feature\/refunds +3 commits since main +● trek ready/)
  expect(frame).toMatch(/fix\/rounding +1 commit since main +○ no trek yet/)
  expect(frame).toMatch(/feature\/partial-refunds +5 commits since main *\n/)
})

test("offers the open pull requests by number and title, with who opened them and what waits", () => {
  const rows = pullRequestRows(open)

  expect(rows.map((row) => [row.label, row.detail])).toEqual([
    ["#12 Add partial refunds", "alice · review requested"],
    ["#14 Round refunds to cents", "bo · draft"],
  ])
  expect(rows[0]?.opens).toBe("pr 12 · Add partial refunds · by alice")
})

test("lists pull requests after the branches, and picking one picks it by its link", async () => {
  const onPick = mock((_choice: ChangeChoice) => undefined)
  await frameAfter(app(onPick), async (input) => {
    await openPicker(input)
    // the pull requests load apart from the branches; moving before they're listed stops short
    await Bun.sleep(150)
    for (const _ of [1, 2, 3, 4]) {
      input.pressKey("j")
    }
    await Bun.sleep(20)
    input.pressEnter()
    await Bun.sleep(20)
  })

  expect(onPick).toHaveBeenCalledWith({
    kind: "pull-request",
    url: "https://github.com/acme/web/pull/12",
  })
})

test("says when there are no open pull requests, or why they can't be listed", async () => {
  const none = await frameAfter(
    app(
      () => undefined,
      () => Promise.resolve([]),
    ),
    openPicker,
  )
  const failed = await frameAfter(
    app(
      () => undefined,
      () => Promise.reject(new Error("gh: not logged in")),
    ),
    openPicker,
  )

  expect(none).toContain("no open pull requests")
  expect(failed).toContain("✕ gh: not logged in")
})
