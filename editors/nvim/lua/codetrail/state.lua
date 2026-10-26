-- The one stepping session, shared by every module.
local M = {
  tour = nil,
  index = 0, -- 0 is the overview; #tour.steps + 1 is the end screen
  stack = {}, -- indexes of the steps stepped into, outermost first
  by_id = {},
  roots = {}, -- repo name -> directory
  changed = {}, -- repo -> file -> line -> "added" | "changed"
  notes = {}, -- step index -> questions asked there
  saved_maps = {}, -- the user's own mappings on the trail's keys, restored when it ends
  show_values = true, -- predicted values at the end of their lines
}

M.ns = vim.api.nvim_create_namespace("codetrail")
-- Predicted values get their own namespace, so hiding them leaves the step's other marks.
M.values_ns = vim.api.nvim_create_namespace("codetrail_values")

return M
