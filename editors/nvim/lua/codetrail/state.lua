-- The one stepping session, shared by every module.
local M = {
  tour = nil,
  index = 0, -- 0 is the overview; #tour.steps + 1 is the end screen
  stack = {}, -- indexes of the steps stepped into, outermost first
  by_id = {},
  roots = {}, -- repo name -> directory
  changed = {}, -- repo -> file -> line -> "added" | "changed"
  notes = {}, -- step index -> questions asked there
  bound = {}, -- buffers with the trail keys bound
}

M.ns = vim.api.nvim_create_namespace("codetrail")

-- Set by init.start; binds the trail keys to one buffer.
M.bind_keys = function(_) end

return M
