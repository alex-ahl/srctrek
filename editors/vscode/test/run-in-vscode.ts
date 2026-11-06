// Runs the extension's checks inside the installed VS Code on a repo holding the two-call pay
// tour. Prints each check, and VS Code's log too when one fails, and exits non-zero then.
//   bun editors/vscode/test/run-in-vscode.ts
import { repoWithTwoCalls } from "../../../packages/serve/test/support/pay-tour"
import { build, runVsCode } from "./launch"

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
const { code, log } = await runVsCode({ workspace: await repoWithTwoCalls(), tests: "suite.js" })
report(code, log)
console.log(code === 0 ? "all checks passed" : `VS Code exited with ${String(code)}`)
process.exit(code)
