import { detectBase } from "./base"
import { runGit } from "./run"

/**
 * A change as the user wrote it. `since-branch-point` is git's three-dot form: what `head`
 * changed since it branched from `base`, the view a pull request shows. `direct` is the
 * two-dot form: `base` and `head` compared as they are.
 */
export type RangeSpec = {
  base: string | undefined // undefined: detect the base branch
  head: string
  mode: "since-branch-point" | "direct"
}

export type ResolvedRange = {
  base: string
  head: string
  mode: RangeSpec["mode"]
  // the commits the change runs between; for since-branch-point, baseCommit is the branch point
  baseCommit: string
  headCommit: string
}

/** "main...feature", "main..feature", "feature" (against the base branch), or "" (HEAD). */
export function parseRange(text: string): RangeSpec {
  const threeDot = text.split("...")
  if (threeDot.length === 2) {
    return {
      base: threeDot[0] || undefined,
      head: threeDot[1] || "HEAD",
      mode: "since-branch-point",
    }
  }
  const twoDot = text.split("..")
  if (twoDot.length === 2) {
    return { base: twoDot[0] || undefined, head: twoDot[1] || "HEAD", mode: "direct" }
  }
  if (text.includes("..")) throw new Error(`not a range: ${text}`)
  return { base: undefined, head: text || "HEAD", mode: "since-branch-point" }
}

/** Resolves branch names to the exact commits the change runs between. */
export async function resolveRange(cwd: string, spec: RangeSpec): Promise<ResolvedRange> {
  const base = spec.base ?? (await detectBase(cwd))
  const headCommit = await runGit(cwd, ["rev-parse", "--verify", `${spec.head}^{commit}`])
  const baseCommit =
    spec.mode === "since-branch-point"
      ? await runGit(cwd, ["merge-base", base, headCommit])
      : await runGit(cwd, ["rev-parse", "--verify", `${base}^{commit}`])
  return { base, head: spec.head, mode: spec.mode, baseCommit, headCommit }
}
