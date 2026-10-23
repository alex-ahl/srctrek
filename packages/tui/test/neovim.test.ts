import { expect, test } from "bun:test"
import { neovimArgs } from "../src/neovim"

test("starts the tour, loading the plugin from a checkout after the user's config", () => {
  expect(neovimArgs("/r/t.json", "/repo/editors/nvim")).toEqual([
    "nvim",
    "-c",
    "set rtp^=/repo/editors/nvim",
    "-c",
    "runtime! plugin/codetrail.lua",
    "-c",
    "Trail /r/t.json",
  ])
})

test("relies on an installed plugin when there is no checkout", () => {
  expect(neovimArgs("/r/t.json", null)).toEqual(["nvim", "-c", "Trail /r/t.json"])
})
