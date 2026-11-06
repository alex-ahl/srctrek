// Runs the extension's checks inside the installed VS Code, with a profile of its own so the user's
// settings and extensions are left alone, on a repo holding the pay tour. Prints each check, and
// VS Code's log too when one fails, and exits non-zero then.
//   bun editors/vscode/test/run-in-vscode.ts
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { repoWithTour } from "../../../packages/serve/test/support/pay-tour"

const EXTENSION = join(import.meta.dir, "..")
const TRAIL = join(import.meta.dir, "../../../packages/cli/src/main.ts")
const VSCODE = "/Applications/Visual Studio Code.app/Contents/MacOS/Code"

async function build(entry: string, outfile: string): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(EXTENSION, entry)],
    outdir: join(EXTENSION, "dist"),
    naming: outfile,
    target: "node",
    format: "cjs",
    external: ["vscode"],
  })
  if (!result.success) {
    throw new AggregateError(result.logs, `building ${entry} failed`)
  }
}

async function runVsCode(workspace: string): Promise<number> {
  const profile = await mkdtemp(join(tmpdir(), "codetrail-vscode-"))
  const vscode = Bun.spawn(
    [
      VSCODE,
      workspace,
      `--user-data-dir=${join(profile, "user")}`,
      `--extensions-dir=${join(profile, "extensions")}`,
      "--disable-extensions",
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-workspace-trust",
      `--extensionDevelopmentPath=${EXTENSION}`,
      `--extensionTestsPath=${join(EXTENSION, "dist/suite.js")}`,
    ],
    {
      env: { ...process.env, CODETRAIL_SERVE: JSON.stringify(["bun", TRAIL, "serve"]) },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const [code, out, err] = await Promise.all([
    vscode.exited,
    new Response(vscode.stdout).text(),
    new Response(vscode.stderr).text(),
  ])
  report(code, `${out}\n${err}`)
  return code
}

// The checks' own lines; VS Code's logging only when something failed, as it's mostly its own
// features talking.
function report(code: number, log: string): void {
  const checks = log.split("\n").filter((line) => /^(ok|FAIL) {2}/.test(line))
  console.log(checks.join("\n"))
  if (code !== 0) {
    console.log(`\nVS Code's log:\n${log}`)
  }
}

await build("src/extension.ts", "extension.js")
await build("test/in-vscode/suite.ts", "suite.js")
const code = await runVsCode(await repoWithTour())
console.log(code === 0 ? "all checks passed" : `VS Code exited with ${String(code)}`)
process.exit(code)
