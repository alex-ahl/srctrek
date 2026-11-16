import { runGit } from "@srctrek/core"
import { commit, commitStaged, makeRepo, repoAt } from "@srctrek/testing"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

// Commits src/app.ts, then a feature branch that changes its line 1.
async function addFeature(dir: string): Promise<string> {
  await mkdir(join(dir, "src"))
  await writeFile(join(dir, "src/app.ts"), "const total = 100\nexport { total }\n")
  await runGit(dir, ["add", "--all"])
  await commitStaged(dir, "base")
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  await commit(dir, "src/app.ts", "const total = 250\nexport { total }\n")

  return dir
}

/** A repo on a feature branch that changes line 1 of src/app.ts. */
export async function makeFeatureRepo(): Promise<string> {
  return addFeature(await makeRepo())
}

/** The same, at `dir`, for a test that needs repos side by side. */
export async function featureRepoIn(dir: string): Promise<string> {
  return addFeature(await repoAt(dir))
}
