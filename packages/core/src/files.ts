import { statSync } from "node:fs"
import { stat } from "node:fs/promises"
import { resolve } from "node:path"

export async function pathExists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

/** Whether a path, relative to `cwd`, is a folder: what trek's arguments are read with. */
export function directoryIn(cwd: string): (path: string) => boolean {
  return (path) => statSync(resolve(cwd, path), { throwIfNoEntry: false })?.isDirectory() ?? false
}
