-- What the plugin keeps while a trek is open; the trek itself and where it stands are the
-- server's.
local M = {
  opening = nil, -- the trek being opened, until the server answers
  view = nil, -- the server's last answer: an overview, a step, or the end
  keys = {}, -- the trek's keys, by action, as configured
  saved_maps = {}, -- the user's own mappings on the trek's keys, restored when it ends
  show_values = true, -- predicted values at the end of their lines
}

M.ns = vim.api.nvim_create_namespace("srctrek")
-- Text at a line's end is drawn in order of priority, lowest first; diagnostics and most plugins
-- use the default, 4096, so the trek's marks come before them rather than pushed off the edge.
M.EOL_PRIORITY = 100
-- Predicted values get their own namespace, so hiding them leaves the step's other marks.
M.values_ns = vim.api.nvim_create_namespace("srctrek_values")

return M
