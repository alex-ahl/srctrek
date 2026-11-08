import { mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const PREFIX = "srctrek-tests-"
const HOUR_MS = 60 * 60 * 1000

// bun test fires no exit event to clean up after a run, so each run clears what earlier runs
// left instead; an hour's age keeps it off a run still going in another terminal.
function clearEarlierRuns(): void {
  const old = readdirSync(tmpdir()).filter((name) => {
    const path = join(tmpdir(), name)
    return name.startsWith(PREFIX) && Date.now() - statSync(path).mtimeMs > HOUR_MS
  })

  for (const name of old) {
    rmSync(join(tmpdir(), name), { recursive: true, force: true })
  }
}

clearEarlierRuns()

// One folder per test run holds every test's temporary folders, so nothing a test makes sits
// among unrelated ones. Real path: macOS links /var to /private/var, and git reports the real
// one.
const RUN = realpathSync(mkdtempSync(join(tmpdir(), PREFIX)))

/** A new empty folder for one test, named `<prefix>XXXXXX`, inside this run's folder. */
export function tempDir(prefix: string): Promise<string> {
  return mkdtemp(join(RUN, prefix))
}
