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

// A link into this repo, not a URL ("https:", "mailto:") or an anchor on the same page.
function isLocalLink(target: string): boolean {
  const hasScheme = /^[a-z]+:/i.test(target)
  return !hasScheme && !target.startsWith("#")
}

export function linkTargets(markdown: string): string[] {
  const targets = [...markdown.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? "")
  return targets.filter(isLocalLink).map(stripAnchor)
}

// Backticked text is checked only when it is unambiguously a path: no spaces, placeholders,
// globs or npm scopes, and either a lowercase file extension or a trailing slash. A bare
// slash isn't enough: protocol methods like `build/progress` have one too.
function looksLikePath(text: string): boolean {
  const plainCharacters = /^[\w.\-/]+$/.test(text)
  const climbsUp = text.includes("..")
  const isFolder = text.endsWith("/")
  const hasExtension = /\.[a-z]{1,4}$/.test(text)

  return plainCharacters && !climbsUp && (isFolder || hasExtension)
}

export function codePaths(markdown: string): string[] {
  const spans = [...markdown.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? "")
  return spans.filter(looksLikePath)
}

export function importPaths(markdown: string): string[] {
  return [...markdown.matchAll(/^@(\S+)$/gm)].map((m) => m[1] ?? "")
}

// The text under "## Current", up to the next heading.
function currentSection(docsReadme: string): string {
  const afterHeading = docsReadme.split(/^## Current\s*$/m)[1] ?? ""
  return afterHeading.split(/^## /m)[0] ?? ""
}

// Only links listed under "## Current" in docs/README.md are current; the rest is history.
export function currentDocLinks(docsReadme: string): string[] {
  return linkTargets(currentSection(docsReadme)).map((t) => join("docs", t))
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
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`)
  }

  return result.stdout.split("\0").filter(Boolean)
}

// "a/b/c.ts" -> ["a", "a/b"]
function parentFolders(file: string): string[] {
  const parent = dirname(file)
  return parent === "." ? [] : [...parentFolders(parent), parent]
}

/** Whether a repo-relative path names one of `files`, or a folder containing one. */
export function existenceIn(files: string[]): (path: string) => boolean {
  const known = new Set(files.flatMap((file) => [file, ...parentFolders(file)]))
  return (path) => {
    const clean = normalize(path).replace(/\/$/, "")
    return clean === "." || known.has(clean)
  }
}

function packageReadmes(root: string): string[] {
  return readdirSync(join(root, "packages")).map((p) => join("packages", p, "README.md"))
}

// An editor's README is for its users, so it's checked for paths and links but not held to a
// package's sections.
function editorReadmes(root: string): string[] {
  return readdirSync(join(root, "editors")).map((e) => join("editors", e, "README.md"))
}

function brokenPaths(root: string, doc: string, exists: (path: string) => boolean): string[] {
  const text = readFileSync(join(root, doc), "utf8")
  const existsFromDoc = (path: string) => exists(join(dirname(doc), path))

  // Links and imports are relative to the doc; code paths may be written from the repo root.
  const brokenLinks = [...linkTargets(text), ...importPaths(text)].filter((p) => !existsFromDoc(p))
  const brokenCode = codePaths(text).filter((p) => !existsFromDoc(p) && !exists(p))

  return [...brokenLinks, ...brokenCode]
}

export function checkDocs(root: string): string[] {
  const exists = existenceIn(visibleFiles(root))
  const read = (doc: string) => readFileSync(join(root, doc), "utf8")
  const readmes = packageReadmes(root)
  const docs = [
    ...ROOT_DOCS,
    ...currentDocLinks(read("docs/README.md")),
    ...readmes,
    ...editorReadmes(root),
  ]

  const missingDocs = docs.filter((doc) => !exists(doc)).map((doc) => `${doc}: file missing`)
  const brokenLinks = docs
    .filter(exists)
    .flatMap((doc) => brokenPaths(root, doc, exists).map((p) => `${doc}: broken path ${p}`))
  const missingReadmeSections = readmes
    .filter(exists)
    .flatMap((readme) =>
      missingSections(read(readme)).map((s) => `${readme}: missing section "## ${s}"`),
    )

  return [...missingDocs, ...brokenLinks, ...missingReadmeSections]
}

if (import.meta.main) {
  const problems = checkDocs(join(import.meta.dirname, ".."))
  if (problems.length > 0) {
    console.error(problems.join("\n"))
    process.exit(1)
  }

  console.log("docs ok")
}
