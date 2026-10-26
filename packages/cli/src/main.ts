import { statSync } from "node:fs"
import { readChangeArguments, resolveChange } from "@codetrail/core"
import { startHome } from "@codetrail/tui"

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
}

async function trail(args: string[]): Promise<void> {
  const cwd = process.cwd()

  // Nothing builds a tour from the change before Milestone 3; resolving it now still fails
  // early, with a message, on arguments that can't be used.
  await resolveChange(cwd, readChangeArguments(args, isDirectory))

  await startHome(cwd)
}

try {
  await trail(process.argv.slice(2))
} catch (error) {
  console.error(`trail: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
