import { expect, test } from "bun:test"
import { neovimArgs } from "../../src/editors/neovim"

const useServe =
  'lua vim.g.srctrek = vim.tbl_deep_extend("force", vim.g.srctrek or {}, { cmd = { "/bin/trek", "serve" } })'

test("starts the trek by name, loading the plugin from a checkout after the user's config", () => {
  expect(neovimArgs("pay", "/repo/editors/nvim", ["/bin/trek", "serve"])).toEqual([
    "nvim",
    "-c",
    "set rtp^=/repo/editors/nvim",
    "-c",
    "runtime! plugin/srctrek.lua",
    "-c",
    useServe,
    "-c",
    "Trek pay",
  ])
})

test("relies on an installed plugin when there is no checkout", () => {
  expect(neovimArgs("pay", null, ["/bin/trek", "serve"])).toEqual([
    "nvim",
    "-c",
    useServe,
    "-c",
    "Trek pay",
  ])
})
