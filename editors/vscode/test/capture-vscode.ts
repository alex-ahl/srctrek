// Captures VS Code's window at each stop of a saved tour, stepping it in the installed VS Code: the
// overview, every stop, and the end, as numbered PNGs in <out-dir>. The workspace is the current
// directory unless given. macOS asks once for the terminal's Screen Recording permission.
//   bun editors/vscode/test/capture-vscode.ts <tour> <out-dir> [workspace]
import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { build, runVsCode } from "./launch"

const [tour, outDir, workspace = process.cwd()] = process.argv.slice(2)
if (tour === undefined || outDir === undefined) {
  console.error("usage: bun editors/vscode/test/capture-vscode.ts <tour> <out-dir> [workspace]")
  process.exit(2)
}

const screens = resolve(outDir)
await mkdir(screens, { recursive: true })
await build("src/extension.ts", "extension.js")
await build("test/in-vscode/capture.ts", "capture.js")
const { code, log } = await runVsCode({
  workspace: resolve(workspace),
  tests: "capture.js",
  env: { SRCTREK_TOUR: tour, SRCTREK_SCREENS: screens },
})
console.log(
  log
    .split("\n")
    .filter((line) => line.startsWith("captured "))
    .join("\n"),
)
if (code !== 0) {
  console.log(`\nVS Code's log:\n${log}`)
}
process.exit(code)
