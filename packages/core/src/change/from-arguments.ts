import { directoryIn } from "../files"
import { defaultCacheDir } from "../repos/cache"
import { readChangeArguments } from "./arguments"
import { type ResolvedChange, resolveChange } from "./resolve"

/** The change trek's arguments name, read from `cwd` and resolved as it is now. */
export function changeFromArguments(
  cwd: string,
  args: readonly string[],
  cacheDir = defaultCacheDir(),
): Promise<ResolvedChange> {
  return resolveChange(cwd, readChangeArguments([...args], directoryIn(cwd)), cacheDir)
}
