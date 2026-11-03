import { expect, test } from "bun:test"
import { neovimArgs } from "../src/neovim"

const useServe =
  'lua vim.g.codetrail = vim.tbl_deep_extend("force", vim.g.codetrail or {}, { cmd = { "/bin/trail", "serve" } })'

test("starts the tour by name, loading the plugin from a checkout after the user's config", () => {
  expect(neovimArgs("pay", "/repo/editors/nvim", ["/bin/trail", "serve"])).toEqual([
    "nvim",
    "-c",
    "set rtp^=/repo/editors/nvim",
    "-c",
    "runtime! plugin/codetrail.lua",
    "-c",
    useServe,
    "-c",
    "Trail pay",
  ])
})

test("relies on an installed plugin when there is no checkout", () => {
  expect(neovimArgs("pay", null, ["/bin/trail", "serve"])).toEqual([
    "nvim",
    "-c",
    useServe,
    "-c",
    "Trail pay",
  ])
})
