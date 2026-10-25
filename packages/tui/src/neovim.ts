import type { CliRenderer } from "@opentui/core"
import { existsSync } from "node:fs"
import { join } from "node:path"

// Present when running from a checkout; a compiled binary relies on the plugin being installed.
const PLUGIN_FROM_SOURCE = join(import.meta.dir, "../../../editors/nvim")

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
  const pluginDir = existsSync(PLUGIN_FROM_SOURCE) ? PLUGIN_FROM_SOURCE : null
  await renderer.suspend()

  const nvim = Bun.spawn(neovimArgs(tourPath, pluginDir), {
    stdio: ["inherit", "inherit", "inherit"],
  })
  await nvim.exited

  await renderer.resume()
}
