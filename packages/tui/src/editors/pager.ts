import type { CliRenderer } from "@opentui/core"

/** Hands the terminal to the user's pager for a file, at its end, and takes it back after. */
export async function openInPager(renderer: CliRenderer, path: string): Promise<void> {
  const pager = process.env["PAGER"]?.trim() || "less"
  const atEnd = pager === "less" ? ["+G"] : []

  await renderer.suspend()
  const shown = Bun.spawn(["sh", "-c", `${pager} "$@"`, "pager", ...atEnd, path], {
    stdio: ["inherit", "inherit", "inherit"],
  })
  await shown.exited

  await renderer.resume()
}
