import { realpath } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"
import { runGit } from "../git/run"
import { folderName } from "./entry"

/** Where a repo's git data is, shared by all its worktrees. */
export async function commonDir(dir: string): Promise<string> {
  return realpath(resolve(dir, await runGit(dir, ["rev-parse", "--git-common-dir"])))
}

/**
 * The folder holding a repo: a clone's own folder (its .git inside it), the project folder of a
 * bare repo kept beside its worktrees (project/.bare with project/main), or a bare repo itself
 * (api.git).
 */
export function projectHome(common: string): string {
  return basename(common).startsWith(".") ? dirname(common) : common
}

/** A repo's name from its project's folder, so every worktree of it is named alike. */
export async function projectName(dir: string): Promise<string> {
  return folderName(projectHome(await commonDir(dir)))
}
