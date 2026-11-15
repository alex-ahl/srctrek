import { hasCommit } from "../../git/refs"
import { defaultCacheDir } from "../../repos/cache"
import { isRemote } from "../../repos/entry"
import { repoDir } from "../../repos/resolve"
import type { Trek } from "../../schema/trek"

/**
 * A repo a trek names that can't be opened here: nothing is where the trek says (`missing`), or
 * the repo there lacks the trek's commit (`no-commit`).
 */
export type UnreachableRepo = Readonly<{
  repo: string
  source: string
  revision: string
  reason: "missing" | "no-commit"
}>

type TrekRepo = Trek["repos"][number]

// Why the repo can't be opened from where the trek says; none when it can.
async function whyUnreachable(
  root: string,
  repo: TrekRepo,
): Promise<UnreachableRepo["reason"] | undefined> {
  const dir = await repoDir(root, repo, defaultCacheDir()).catch(() => undefined)
  if (dir === undefined) {
    return "missing"
  }

  return (await hasCommit(dir, repo.revision)) ? undefined : "no-commit"
}

async function unreachable(root: string, repo: TrekRepo): Promise<UnreachableRepo | undefined> {
  const reason = await whyUnreachable(root, repo)
  if (reason === undefined) {
    return undefined
  }

  return { repo: repo.name, source: repo.source, revision: repo.revision, reason }
}

/**
 * The first of the trek's local repos that can't be opened here, if any. Remote repos are
 * fetched when the trek opens, so they aren't checked: that would reach the network on every
 * look at the trek's status.
 */
export async function unreachableRepo(
  root: string,
  trek: Trek,
): Promise<UnreachableRepo | undefined> {
  const local = trek.repos.filter((repo) => !isRemote(repo.source))
  const found = await Promise.all(local.map((repo) => unreachable(root, repo)))

  return found.find((repo) => repo !== undefined)
}
