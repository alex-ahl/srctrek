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

/**
 * This trek's own `trek serve`, so the plugin talks to the same version: the binary itself
 * when compiled (its entry point is inside the binary), or bun with the entry point.
 */
export function serveCommand(): string[] {
  const compiled = Bun.main.startsWith("/$bunfs/")

  return compiled ? [process.execPath, "serve"] : [process.execPath, Bun.main, "serve"]
}

// A JSON string is a Lua string literal too, for anything without control characters.
const luaList = (items: string[]) => `{ ${items.map((item) => JSON.stringify(item)).join(", ")} }`

export function neovimArgs(tourName: string, pluginDir: string | null, serve: string[]): string[] {
  // -c runs after the user's config, so a plugin manager that resets the runtimepath at
  // startup can't drop the checkout's plugin directory, and the user's settings are kept.
  const loadPlugin = pluginDir
    ? ["-c", `set rtp^=${pluginDir}`, "-c", "runtime! plugin/srctrek.lua"]
    : []
  const useServe = `lua vim.g.srctrek = vim.tbl_deep_extend("force", vim.g.srctrek or {}, { cmd = ${luaList(serve)} })`

  return ["nvim", ...loadPlugin, "-c", useServe, "-c", `Trek ${tourName}`]
}

/** Hands the terminal to Neovim for the tour, and takes it back when Neovim exits. */
export async function openInNeovim(renderer: CliRenderer, tourName: string): Promise<void> {
  const pluginDir = checkoutPluginDir()
  await renderer.suspend()

  const nvim = Bun.spawn(neovimArgs(tourName, pluginDir, serveCommand()), {
    stdio: ["inherit", "inherit", "inherit"],
  })
  await nvim.exited

  await renderer.resume()
}
