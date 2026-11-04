import { describe, expect, test } from "bun:test"
import { realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tempDir } from "../../core/test/support/temp"
import { repoWithEdit, repoWithTour, repoWithTwoCalls } from "./support/pay-tour"

const PLUGIN = join(import.meta.dir, "../../../editors/nvim")
const DRIVER = join(import.meta.dir, "nvim-driver.lua")
const TRAIL = join(import.meta.dir, "../../cli/src/main.ts")

/** What the editor shows after an action, as nvim-driver.lua records it. */
type Screen = {
  view: "overview" | "step" | "end" | null
  file: string
  line: number
  winbar: string
  float: string[] | null
  virt_lines: string[]
  values: { line: number; text: string }[]
  signs: { line: number; text: string }[]
  calls: { line: number; text: string }[]
  user_float: boolean
  first_line: string
  modified: boolean
  path: string
  read_only: boolean
  event: { path: string; shown: string; line: number } | null
  floats: number
  notices: string[]
}

function isScreens(value: unknown): value is Screen[] {
  return (
    Array.isArray(value) && value.every((screen) => typeof screen === "object" && "view" in screen)
  )
}

// Headless Neovim in `dir` with the checkout's plugin, running `actions` against the real
// trail serve.
async function drive(dir: string, actions: string[]): Promise<Screen[]> {
  const out = join(await tempDir("nvim-"), "screens.json")
  const nvim = Bun.spawn(
    [
      "nvim",
      "--headless",
      "--clean",
      "--cmd",
      `set rtp^=${PLUGIN}`,
      "-c",
      "runtime! plugin/codetrail.lua",
      "-c",
      `luafile ${DRIVER}`,
    ],
    {
      cwd: dir,
      env: {
        ...process.env,
        XDG_CACHE_HOME: await tempDir("cache-"),
        DRIVE_CMD: JSON.stringify(["bun", TRAIL, "serve"]),
        DRIVE_ACTIONS: actions.join(","),
        DRIVE_OUT: out,
      },
      stderr: "inherit",
    },
  )
  await nvim.exited

  const screens: unknown = await Bun.file(out).json()
  if (!isScreens(screens)) {
    throw new Error(`unexpected screens: ${JSON.stringify(screens)}`)
  }

  return screens
}

describe.skipIf(Bun.which("nvim") === null)("the Neovim plugin on trail serve", () => {
  test("opens a saved tour at its overview, then draws the step the server answers with", async () => {
    const [overview, first] = await drive(await repoWithTour(), ["start:pay", "next"])

    expect(overview).toMatchObject({ view: "overview", notices: [] })
    expect(overview?.float).toContain("**Outcome:** paid")
    expect(first).toMatchObject({ view: "step", file: "main.ts", line: 1 })
    // the repo is named after its temporary folder
    expect(first?.winbar).toStartWith(" codetrail   1/3  ·  ")
    expect(first?.winbar).toEndWith(" · main.ts:1  ·  main.ts:1")
    // the change adds main.ts whole, so a tag says so instead of a + on every line
    expect(first?.virt_lines).toEqual(["▌ main calls pay  new file"])
    expect(first?.signs).toEqual([{ line: 1, text: "▶" }])
    expect(first?.calls).toEqual([{ line: 1, text: "  →" }])
  }, 30_000)

  test("marks the lines a change edits, beside the step's first line", async () => {
    const [, step] = await drive(await repoWithEdit(), ["start:pay", "next"])

    expect(step?.virt_lines).toEqual(["▌ main pays, then logs double"])
    expect(step?.signs).toEqual([
      { line: 1, text: "▶" },
      { line: 2, text: "~" },
    ])
  }, 30_000)

  test("draws a called step with its stack, high flag, and predicted values", async () => {
    const [, , into, hidden] = await drive(await repoWithTour(), [
      "start:pay",
      "next",
      "into",
      "values",
    ])

    expect(into).toMatchObject({ file: "pay.ts", line: 1 })
    expect(into?.winbar).toContain(" codetrail   2/3  ·  ")
    expect(into?.winbar).toEndWith(" · pay.ts:1  ·  main.ts:1 › pay")
    expect(into?.virt_lines).toEqual(["▌ s  new file", "▌ ⚠ 250 is hard-coded"])
    expect(into?.values).toEqual([{ line: 2, text: "  ≈ returns 250" }])
    expect(hidden?.values).toEqual([])
  }, 30_000)

  test("steps out to the end and back, and clears the editor on quit", async () => {
    const [, , , out, end, back, quit] = await drive(await repoWithTour(), [
      "start:pay",
      "next",
      "into",
      "out",
      "next",
      "previous",
      "quit",
    ])

    expect(out).toMatchObject({ file: "main.ts", line: 2 })
    expect(out?.winbar).toContain(" codetrail   3/3  ·  ")
    expect(end).toMatchObject({ view: "end" })
    expect(end?.float).toContain("**End of tour.** paid")
    expect(back).toMatchObject({ view: "step", file: "main.ts", line: 2 })
    expect(quit).toMatchObject({ view: null, winbar: "", virt_lines: [], signs: [] })
  }, 30_000)

  test("marks each line that makes a call, and steps into the one under the cursor", async () => {
    const [, calling, , into] = await drive(await repoWithTwoCalls(), [
      "start:pay",
      "next",
      "cursor:2",
      "into",
    ])

    expect(calling?.calls).toEqual([
      { line: 1, text: "  →" },
      { line: 2, text: "  →" },
    ])
    expect(into).toMatchObject({ file: "send.ts", line: 1 })
  }, 30_000)

  test("steps into the first call not yet visited when the cursor's line makes none", async () => {
    const [, , , into] = await drive(await repoWithTwoCalls(), [
      "start:pay",
      "next",
      "cursor:3",
      "into",
    ])

    expect(into).toMatchObject({ file: "pay.ts", line: 1 })
  }, 30_000)

  test("opens the user's own file when it's the tour's version", async () => {
    const dir = await repoWithTour()
    const [, step] = await drive(dir, ["start:pay", "next"])

    expect(step).toMatchObject({ path: join(await realpath(dir), "main.ts"), read_only: false })
    expect(step?.winbar).not.toContain("tour's version")
  }, 30_000)

  test("opens the tour's copy, read-only, of a file the user has edited since", async () => {
    const dir = await repoWithTour()
    await writeFile(join(dir, "main.ts"), "const total = pay() * 2\nconsole.log(total)\n")
    const [, step] = await drive(dir, ["start:pay", "next"])

    expect(step).toMatchObject({ file: "main.ts", read_only: true })
    expect(step?.path.startsWith(await realpath(dir))).toBe(false)
    expect(step?.winbar).toContain("tour's version")
    // a file tree still follows to the user's own main.ts
    expect(step?.event).toMatchObject({
      path: join(await realpath(dir), "main.ts"),
      shown: step?.path,
    })
  }, 30_000)

  test("says in details where a step came from, with its evidence, and goes back there", async () => {
    const [, , , details, back] = await drive(await repoWithTour(), [
      "start:pay",
      "next",
      "into",
      "details",
      "enter:came from",
    ])

    expect(details?.float).toContain("→ came from 1 · main.ts:1")
    expect(details?.float?.join("\n")).toMatch(/evidence: [^/]+\/main\.ts:1/)
    expect(back).toMatchObject({ view: "step", file: "main.ts", line: 1, floats: 0 })
  }, 30_000)

  test("steps over a call to where the caller carries on", async () => {
    const [, , over] = await drive(await repoWithTour(), ["start:pay", "next", "over"])

    expect(over).toMatchObject({ file: "main.ts", line: 2 })
  }, 30_000)

  test("says when the cursor leaves the step, and goes back to it", async () => {
    const [, , away, back] = await drive(await repoWithTour(), [
      "start:pay",
      "next",
      "cursor:2",
      "current",
    ])

    expect(away?.winbar).toContain("away · <leader>tc returns")
    expect(back).toMatchObject({ file: "main.ts", line: 1 })
    expect(back?.winbar).not.toContain("away")
  }, 30_000)

  test("puts the user back on the file and line they had when the tour ends", async () => {
    // the tour is on main.ts when it ends
    const [, , , , quit] = await drive(await repoWithTour(), [
      "edit:pay.ts",
      "cursor:2",
      "start:pay",
      "next",
      "quit",
    ])

    expect(quit).toMatchObject({ file: "pay.ts", line: 2, winbar: "" })
  }, 30_000)

  test("keeps unsaved changes and undo history with 'hidden' off, and steps on", async () => {
    const [, , , , stepped, quit] = await drive(await repoWithTour(), [
      "nohidden",
      "edit:pay.ts",
      "type:// mine",
      "start:pay",
      "next",
      "quit",
    ])

    expect(stepped).toMatchObject({ file: "main.ts", notices: [] })
    expect(quit).toMatchObject({ file: "pay.ts", first_line: "// mine", modified: true })
  }, 30_000)

  test("puts the window's own winbar back off a step and on quit", async () => {
    const screens = await drive(await repoWithTour(), [
      "winbar:mine",
      "start:pay",
      "next",
      "previous",
      "next",
      "quit",
    ])
    const winbars = screens.map((screen) => screen.winbar)

    expect(winbars[2]).toContain(" codetrail ")
    expect([winbars[1], winbars[3], winbars[5]]).toEqual(["mine", "mine", "mine"])
  }, 30_000)

  test("closes its own popups on a move, and leaves other plugins' floats open", async () => {
    const [, , moved] = await drive(await repoWithTour(), ["start:pay", "userfloat", "next"])

    // the overview's popup closed, the other plugin's float still open
    expect(moved).toMatchObject({ view: "step", user_float: true, floats: 1 })
  }, 30_000)

  test("reports a tour the server can't find", async () => {
    const [screen] = await drive(await repoWithTour(), ["start:nope"])

    expect(screen).toMatchObject({ view: null })
    expect(screen?.notices.join("\n")).toContain("no tour named nope")
  }, 30_000)
})
