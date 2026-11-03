-- The tab a tour shows in: its own, so the user's windows stay as they were and being in the
-- tab is being in the tour. A fresh Neovim's only tab, holding nothing, is used as it is.
local state = require("codetrail.state")

local M = {}

local function is_empty(buf)
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  return vim.api.nvim_buf_get_name(buf) == "" and not vim.bo[buf].modified and #lines == 1 and lines[1] == ""
end

local function is_fresh()
  local only_tab = #vim.api.nvim_list_tabpages() == 1
  local only_window = #vim.api.nvim_tabpage_list_wins(0) == 1
  return only_tab and only_window and is_empty(vim.api.nvim_get_current_buf())
end

function M.focus()
  if state.tab and vim.api.nvim_tabpage_is_valid(state.tab) then
    vim.api.nvim_set_current_tabpage(state.tab)
  end
end

function M.enter()
  if state.tab and vim.api.nvim_tabpage_is_valid(state.tab) then
    M.focus()
    return
  end

  state.own_tab = not is_fresh()
  if state.own_tab then
    vim.cmd("tabnew")
  end
  state.tab = vim.api.nvim_get_current_tabpage()
end

function M.is_open()
  return state.tab ~= nil and vim.api.nvim_tabpage_is_valid(state.tab)
end

-- Closes the tab if the tour opened it; a tab the user had is left as it is.
function M.leave()
  local tab, own = state.tab, state.own_tab
  state.tab, state.own_tab = nil, false
  if own and tab and vim.api.nvim_tabpage_is_valid(tab) and #vim.api.nvim_list_tabpages() > 1 then
    pcall(vim.cmd.tabclose, vim.api.nvim_tabpage_get_number(tab))
  end
end

return M
