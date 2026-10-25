import { spawnSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join, normalize } from "node:path"

export const PACKAGE_README_SECTIONS = [
  "What it is",
  "What it does, and does not",
  "Where it fits",
  "Why a package of its own",
]

const ROOT_DOCS = ["AGENTS.md", "CLAUDE.md", "README.md", "DECISIONS.md", "docs/README.md"]

export function linkTargets(markdown: string): string[] {
  const targets = [...markdown.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? "")
  return targets.filter((t) => !/^[a-z]+:/i.test(t) && !t.startsWith("#")).map(stripAnchor)
}

// Backticked text is checked only when it is unambiguously a path: no spaces, placeholders,
// globs or npm scopes, and either a lowercase file extension or a trailing slash. A bare
// slash isn't enough: protocol methods like `build/progress` have one too.
export function codePaths(markdown: string): string[] {
  const spans = [...markdown.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? "")
  return spans.filter(
    (s) =>
      /^[\w.\-/]+$/.test(s) && !s.includes("..") && (s.endsWith("/") || /\.[a-z]{1,4}$/.test(s)),
  )
}

export function importPaths(markdown: string): string[] {
  return [...markdown.matchAll(/^@(\S+)$/gm)].map((m) => m[1] ?? "")
}

// Only links listed under "## Current" in docs/README.md are current; the rest is history.
export function currentDocLinks(docsReadme: string): string[] {
  const section = docsReadme.split(/^## Current\s*$/m)[1]?.split(/^## /m)[0] ?? ""
  return linkTargets(section).map((t) => join("docs", t))
}

export function missingSections(readme: string): string[] {
  const headings = new Set([...readme.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]))
  return PACKAGE_README_SECTIONS.filter((s) => !headings.has(s))
}

function stripAnchor(target: string): string {
  return target.split("#")[0] ?? target
}

// Tracked files plus new ones not yet added; gitignored files exist only on this machine, so
// they don't count, matching what a clean checkout (and CI) has.
function visibleFiles(root: string): string[] {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr}`)
  return result.stdout.split("\0").filter(Boolean)
}

/** Whether a repo-relative path names one of `files`, or a folder containing one. */
export function existenceIn(files: string[]): (path: string) => boolean {
  const known = new Set(files)
  for (const file of files) {
    const parts = file.split("/")
    for (let i = 1; i < parts.length; i++) known.add(parts.slice(0, i).join("/"))
  }
  return (path) => {
    const clean = normalize(path).replace(/\/$/, "")
    return clean === "." || known.has(clean)
  }
}

function packageReadmes(root: string): string[] {
  return readdirSync(join(root, "packages")).map((p) => join("packages", p, "README.md"))
}

function brokenPaths(root: string, doc: string, exists: (path: string) => boolean): string[] {
  const text = readFileSync(join(root, doc), "utf8")
  const docDir = dirname(doc)
  const fromDoc = [...linkTargets(text), ...importPaths(text)].filter(
    (p) => !exists(join(docDir, p)),
  )
  const fromCode = codePaths(text).filter((p) => !exists(join(docDir, p)) && !exists(p))
  return [...fromDoc, ...fromCode]
}

export function checkDocs(root: string): string[] {
  const exists = existenceIn(visibleFiles(root))
  const readmes = packageReadmes(root)
  const docsReadme = readFileSync(join(root, "docs/README.md"), "utf8")
  const docs = [...ROOT_DOCS, ...currentDocLinks(docsReadme), ...readmes]
  const problems: string[] = []
  for (const doc of docs) {
    if (!exists(doc)) {
      problems.push(`${doc}: file missing`)
      continue
    }
    for (const p of brokenPaths(root, doc, exists)) problems.push(`${doc}: broken path ${p}`)
  }
  for (const readme of readmes.filter((r) => exists(r))) {
    for (const s of missingSections(readFileSync(join(root, readme), "utf8"))) {
      problems.push(`${readme}: missing section "## ${s}"`)
    }
  }
  return problems
}

if (import.meta.main) {
  const problems = checkDocs(join(import.meta.dirname, ".."))
  for (const p of problems) console.error(p)
  if (problems.length > 0) process.exit(1)
  console.log("docs ok")
}
