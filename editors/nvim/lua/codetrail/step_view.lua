-- Draws one step in the editor: its lines highlighted, change signs, and narration above it.
local state = require("codetrail.state")
local text = require("codetrail.text")

local M = {}

function M.clear()
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_valid(buf) then
      vim.api.nvim_buf_clear_namespace(buf, state.ns, 0, -1)
    end
  end
end

-- A normal editor window for the step's file, not a file tree or other side window.
local function editor_window()
  local current = vim.api.nvim_get_current_win()
  if vim.bo[vim.api.nvim_win_get_buf(current)].buftype == "" then
    return current
  end
  for _, win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
    local normal = vim.api.nvim_win_get_config(win).relative == ""
    if normal and vim.bo[vim.api.nvim_win_get_buf(win)].buftype == "" then
      return win
    end
  end
  return current
end

local function highlight_range(buf, s, e)
  for l = s, e do
    vim.api.nvim_buf_set_extmark(buf, state.ns, l - 1, 0, { line_hl_group = "CodetrailStep" })
  end
end

local function mark_changes(buf, step, last)
  local file_changes = (step.changes[step.repo] or {})[step.file] or {}
  for line, kind in pairs(file_changes) do
    local l = tonumber(line)
    if l <= last then
      vim.api.nvim_buf_set_extmark(buf, state.ns, l - 1, 0, {
        sign_text = kind == "added" and "+" or "~",
        sign_hl_group = kind == "added" and "CodetrailAdded" or "CodetrailChanged",
      })
    end
  end
end

-- Virtual lines don't wrap, so the text is wrapped here, up to three lines each; the full
-- text is in the details view. The sign column may appear only after this redraw, so its
-- two columns are reserved up front.
local function narration(step)
  local width = vim.api.nvim_win_get_width(0) - vim.fn.getwininfo(vim.api.nvim_get_current_win())[1].textoff - 4
  local lines = {}
  for _, l in ipairs(text.wrap("▶ " .. step.summary, width, 3, "  ")) do
    table.insert(lines, { { l, "CodetrailSummary" } })
  end
  if not step.changed then
    table.insert(lines[#lines], { "  unchanged", "CodetrailMuted" })
  end
  -- only high-severity flags show inline; the rest are in the details view
  local flag = step.uncertain
  if flag and flag ~= vim.NIL and flag.severity == "high" then
    for _, l in ipairs(text.wrap("⚠ " .. flag.note, width, 3, "  ")) do
      table.insert(lines, { { l, "CodetrailWarn" } })
    end
  end
  return lines
end

function M.show(step)
  M.clear()
  vim.api.nvim_set_current_win(editor_window())
  vim.cmd("edit " .. vim.fn.fnameescape(step.path))
  local buf = vim.api.nvim_get_current_buf()
  local last = vim.api.nvim_buf_line_count(buf)
  local s, e = math.min(step.start_line, last), math.min(step.end_line, last)

  highlight_range(buf, s, e)
  mark_changes(buf, step, last)
  local lines = narration(step)
  vim.api.nvim_buf_set_extmark(buf, state.ns, s - 1, 0, { virt_lines = lines, virt_lines_above = true })

  vim.api.nvim_win_set_cursor(0, { s, 0 })
  vim.cmd("normal! zz")
  -- virtual lines above the first line stay hidden unless the window is scrolled to show them
  if s == 1 then
    vim.fn.winrestview({ topline = 1, topfill = #lines })
  end
end

return M
