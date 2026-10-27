import type { ResolvedChange, ResolvedRepo } from "../change/resolve"

/** The change's repo called `name`; when there's none, the error lists the names there are. */
export function repoNamed(change: ResolvedChange, name: string): ResolvedRepo {
  const repo = change.repos.find((candidate) => candidate.name === name)
  if (repo === undefined) {
    const names = change.repos.map((candidate) => candidate.name).join(", ")
    throw new Error(`no repo named ${name}; the change has ${names}`)
  }

  return repo
}

/** git arguments limiting a command to `folder`; none when there's no folder. */
export function pathsUnder(folder: string | undefined): string[] {
  return folder === undefined ? [] : ["--", folder]
}

/** "api at 1a2b3c4": how a repo and its revision are named in messages. */
export function describeRepo(repo: ResolvedRepo): string {
  return `${repo.name} at ${repo.revision.slice(0, 7)}`
}
