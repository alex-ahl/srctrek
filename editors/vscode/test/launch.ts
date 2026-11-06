// Starting the installed VS Code on the extension, with a profile of its own so the user's
// settings and extensions are left alone; shared by the checks and the screen capture.
import { mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const EXTENSION = join(import.meta.dir, "..")
const TRAIL = join(import.meta.dir, "../../../packages/cli/src/main.ts")
const VSCODE = "/Applications/Visual Studio Code.app/Contents/MacOS/Code"
// maximized, so a capture shows the editor at full size, and without the chat sidebar, which isn't
// part of the tour
const SETTINGS = {
  "window.newWindowDimensions": "maximized",
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "workbench.startupEditor": "none",
}

/** Bundles one of the extension's entry points into its dist, as VS Code loads it. */
export async function build(entry: string, outfile: string): Promise<void> {
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

async function newProfile(): Promise<string> {
  const profile = await mkdtemp(join(tmpdir(), "codetrail-vscode-"))
  await mkdir(join(profile, "user/User"), { recursive: true })
  await Bun.write(join(profile, "user/User/settings.json"), JSON.stringify(SETTINGS))
  return profile
}

export type Run = { workspace: string; tests: string; env?: Record<string, string> }

/** Opens `workspace` and runs the bundled `tests` in it; answers with the exit code and the log. */
export async function runVsCode(run: Run): Promise<{ code: number; log: string }> {
  const profile = await newProfile()
  const vscode = Bun.spawn(
    [
      VSCODE,
      run.workspace,
      `--user-data-dir=${join(profile, "user")}`,
      `--extensions-dir=${join(profile, "extensions")}`,
      "--disable-extensions",
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-workspace-trust",
      `--extensionDevelopmentPath=${EXTENSION}`,
      `--extensionTestsPath=${join(EXTENSION, "dist", run.tests)}`,
    ],
    {
      env: {
        ...process.env,
        CODETRAIL_SERVE: JSON.stringify(["bun", TRAIL, "serve"]),
        ...run.env,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const [code, out, err] = await Promise.all([
    vscode.exited,
    new Response(vscode.stdout).text(),
    new Response(vscode.stderr).text(),
  ])
  return { code, log: `${out}\n${err}` }
}
