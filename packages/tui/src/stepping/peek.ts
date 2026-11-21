import { runGit } from "@srctrek/core"

/** A place to look at beside the trek: a file at a line, saying what it is. */
export type Look = Readonly<{ path: string; line: number; label: string }>

const NOT_CALLS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "return",
  "function",
  "catch",
  "typeof",
  "await",
  "new",
])

/** The function the line calls first, by name: "charge" in `await charge(order, -amount)`. */
export function calledOn(line: string): string | undefined {
  const called = [...line.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map((match) => match[1] ?? "")
  return called.find((name) => !NOT_CALLS.has(name))
}

// How a definition of `name` starts, in the languages people write: a function, a class, a name
// declared, or a method.
const definitionPattern = (name: string) => {
  // POSIX classes, which every git's grep reads: \s and \b aren't in all of them
  const space = "[[:space:]]"
  const end = "([^[:alnum:]_$]|$)"
  return [
    `(function|def|fn|func|fun|sub|const|let|var|class)${space}+${name}${end}`,
    `(^|[^[:alnum:]_$])${name}${space}*[:=]${space}*(async${space}*)?(function|\\()`,
    `^${space}*(async${space}+)?${name}${space}*\\([^)]*\\)${space}*\\{`,
  ].join("|")
}

// How much of their path two files share, folder by folder.
function sharedFolders(a: string, b: string): number {
  const [left, right] = [a.split("/"), b.split("/")]
  const differs = left.findIndex((part, i) => part !== right[i])
  return differs === -1 ? left.length : differs
}

/** `looks` nearest `from` first: in its file, then its folder, then sharing most of its path. */
export function nearestFirst(looks: readonly Look[], from: string): Look[] {
  return looks.toSorted((a, b) => sharedFolders(b.path, from) - sharedFolders(a.path, from))
}

/**
 * Where `name` is defined in the repo at `dir`, found by name, as git grep finds it at the
 * checked-out revision; several when the name is defined more than once.
 */
export async function definitionsOf(dir: string, name: string): Promise<Look[]> {
  const out = await runGit(dir, ["grep", "-n", "-E", definitionPattern(name)]).catch(() => "")
  return out
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [file = "", at = "1"] = line.split(":")
      return { path: `${dir}/${file}`, line: Number(at), label: `${name} · ${file}:${at}` }
    })
}
