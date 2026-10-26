import type { CliRenderer } from "@opentui/core"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

// The checkout's plugin: beside this source when run with bun, beside dist/ when compiled (a
// compiled binary's import.meta.dir is inside the binary). An installed binary relies on the
// plugin being installed.
const PLUGIN_IN_CHECKOUT = [
  join(import.meta.dir, "../../../editors/nvim"),
  join(dirname(process.execPath), "../editors/nvim"),
]

export function checkoutPluginDir(): string | null {
  return PLUGIN_IN_CHECKOUT.find((dir) => existsSync(dir)) ?? null
}

export function neovimArgs(tourPath: string, pluginDir: string | null): string[] {
  // -c runs after the user's config, so a plugin manager that resets the runtimepath at
  // startup can't drop the checkout's plugin directory.
  const loadPlugin = pluginDir
    ? ["-c", `set rtp^=${pluginDir}`, "-c", "runtime! plugin/codetrail.lua"]
    : []

  return ["nvim", ...loadPlugin, "-c", `Trail ${tourPath}`]
}

/** Hands the terminal to Neovim for the tour, and takes it back when Neovim exits. */
export async function openInNeovim(renderer: CliRenderer, tourPath: string): Promise<void> {
  const pluginDir = checkoutPluginDir()
  await renderer.suspend()

  const nvim = Bun.spawn(neovimArgs(tourPath, pluginDir), {
    stdio: ["inherit", "inherit", "inherit"],
  })
  await nvim.exited

  await renderer.resume()
}
