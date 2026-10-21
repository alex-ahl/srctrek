import { describe, expect, test } from "bun:test"
import {
  PACKAGE_README_SECTIONS,
  codePaths,
  currentDocLinks,
  importPaths,
  linkTargets,
  missingSections,
} from "./check-docs"

describe("linkTargets", () => {
  test("keeps relative links, drops urls and anchors", () => {
    const md = "[a](docs/A.md) [b](https://x.dev) [c](#top) [d](B.md#part)"
    expect(linkTargets(md)).toEqual(["docs/A.md", "B.md"])
  })
})

describe("codePaths", () => {
  test("keeps only spans that are clearly paths", () => {
    const md = [
      "`packages/core/`",
      "`AGENTS.md`",
      "`bun run check`",
      "`main...HEAD`",
      "`@opentui/core`",
      "`.codetrail/tours/<name>.json`",
      "`$EDITOR`",
    ].join(" ")
    expect(codePaths(md)).toEqual(["packages/core/", "AGENTS.md"])
  })
})

describe("importPaths", () => {
  test("reads @ imports on their own line", () => {
    expect(importPaths("@AGENTS.md\nsee @x inline")).toEqual(["AGENTS.md"])
  })
})

describe("currentDocLinks", () => {
  test("reads links from the Current section only", () => {
    const md = "## Current\n- [A](A.md)\n\n## History\n- [Old](old/B.md)\n"
    expect(currentDocLinks(md)).toEqual(["docs/A.md"])
  })
})

describe("missingSections", () => {
  test("reports absent sections", () => {
    expect(missingSections("## What it is\n## Where it fits\n")).toEqual([
      "What it does, and does not",
      "Why a package of its own",
    ])
  })

  test("passes a complete readme", () => {
    const md = PACKAGE_README_SECTIONS.map((s) => `## ${s}`).join("\n")
    expect(missingSections(md)).toEqual([])
  })
})
