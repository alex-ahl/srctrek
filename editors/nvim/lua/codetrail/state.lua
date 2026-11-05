-- What the plugin keeps while a tour is open; the tour itself and where it stands are the
-- server's.
local M = {
  overview = nil, -- the open tour's overview, as the server first answered
  opening = nil, -- the tour being opened, until the server answers
  view = nil, -- the server's last answer: an overview, a step, or the end
  roots = {}, -- repo name -> checkout, from the steps seen so far
  notes = {}, -- step id -> questions asked there this session
  keys = {}, -- the tour's keys, by action, as configured
  saved_maps = {}, -- the user's own mappings on the tour's keys, restored when it ends
  show_values = true, -- predicted values at the end of their lines
}

M.ns = vim.api.nvim_create_namespace("codetrail")
-- Text at a line's end is drawn in order of priority, lowest first; diagnostics and most plugins
-- use the default, 4096, so the tour's marks come before them rather than pushed off the edge.
M.EOL_PRIORITY = 100
-- Predicted values get their own namespace, so hiding them leaves the step's other marks.
M.values_ns = vim.api.nvim_create_namespace("codetrail_values")

return M
