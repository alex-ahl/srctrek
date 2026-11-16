-- Draws one step in the editor: its lines tinted with a bar at the left edge, change signs, the
-- narration above it, and an arrow at each line that leads to another step.
local arrows = require("srctrek.step.arrows")
local inline_values = require("srctrek.inline_values")
local narration = require("srctrek.step.narration")
local origin = require("srctrek.origin")
local state = require("srctrek.state")

local M = {}

-- The trek's copies whose diagnostics are hidden, to show again when the trek ends.
local quieted = {}

-- A copy in srctrek's cache has no dependencies installed, so a language server flags every import;
-- the errors can't be acted on in a read-only copy. The user's own files keep theirs.
local function quiet_diagnostics(buf)
  if not quieted[buf] then
    quieted[buf] = true
    vim.diagnostic.enable(false, { bufnr = buf })
  end
end

function M.restore_diagnostics()
  for buf in pairs(quieted) do
    if vim.api.nvim_buf_is_valid(buf) then
      vim.diagnostic.enable(true, { bufnr = buf })
    end
  end
  quieted = {}
end

function M.clear()
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_valid(buf) then
      vim.api.nvim_buf_clear_namespace(buf, state.ns, 0, -1)
      vim.api.nvim_buf_clear_namespace(buf, state.values_ns, 0, -1)
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

local CHANGE_SIGNS = {
  added = { text = "+", group = "SrctrekAdded" },
  changed = { text = "~", group = "SrctrekChanged" },
}

-- One sign per line, as the sign column shows one: the change's own lines carry theirs, the
-- step's other lines the bar, and its first line ▶ like a debugger's current line, followed by
-- that line's change sign if it has one.
local function signs(view, first, last, new_file)
  local by_line = {}
  for l = first, last do
    by_line[l] = { text = "▎", group = "SrctrekStepBar" }
  end
  for _, changed in ipairs(new_file and {} or view.changed_lines) do
    by_line[changed.line] = CHANGE_SIGNS[changed.change]
  end
  local first_change = by_line[first].group == "SrctrekStepBar" and "" or by_line[first].text
  by_line[first] = { text = "▶" .. first_change, group = "SrctrekCurrent" }
  return by_line
end

local function mark_lines(buf, view, first, last, new_file)
  local line_count = vim.api.nvim_buf_line_count(buf)
  for l, sign in pairs(signs(view, first, last, new_file)) do
    if l <= line_count then
      local in_step = l >= first and l <= last
      -- the step's tint runs under its signs and line numbers too, from the window's left edge
      vim.api.nvim_buf_set_extmark(buf, state.ns, l - 1, 0, {
        sign_text = sign.text,
        sign_hl_group = in_step and (sign.group .. "InStep") or sign.group,
        line_hl_group = in_step and "SrctrekStep" or nil,
        number_hl_group = in_step and "SrctrekStepNumber" or nil,
      })
    end
  end
end

-- A file the change adds whole, so one tag says it rather than a + on every line.
local function is_new_file(view, line_count)
  local added = vim.tbl_filter(function(changed)
    return changed.change == "added"
  end, view.changed_lines)
  return #added >= line_count
end

-- The step near the top, a few lines below it, without scrolling past the end of a short file;
-- virtual lines above a window's first line show only when it's scrolled to show them.
local function place_window(first, line_count, above)
  local height = vim.api.nvim_win_get_height(0)
  local latest = math.max(1, line_count - height + above + 1)
  local top = math.min(math.max(1, first - 3), latest)
  vim.api.nvim_win_set_cursor(0, { first, 0 })
  vim.fn.winrestview({ topline = top, topfill = top == first and above or 0 })
end

-- Measured after a redraw: a sign column that appears with the step's signs counts only once
-- it's on screen.
local function window_layout()
  vim.cmd("redraw")
  local win = vim.api.nvim_get_current_win()
  return { width = vim.api.nvim_win_get_width(win), indent = vim.fn.getwininfo(win)[1].textoff }
end

function M.show(view)
  M.clear()
  local win = editor_window()
  origin.keep(win)
  vim.api.nvim_set_current_win(win)
  vim.cmd("edit " .. vim.fn.fnameescape(view.path))
  local buf = vim.api.nvim_get_current_buf()
  -- the trek's copy lives in srctrek's cache, where an edit would be lost
  if view.trek_copy then
    vim.bo[buf].readonly = true
    vim.bo[buf].modifiable = false
    quiet_diagnostics(buf)
  end
  local line_count = vim.api.nvim_buf_line_count(buf)
  local first, last = math.min(view.start_line, line_count), math.min(view.end_line, line_count)

  local new_file = is_new_file(view, line_count)
  mark_lines(buf, view, first, last, new_file)
  arrows.show(buf, view, line_count)
  inline_values.show(buf, view.predicted_values, line_count)
  local above = narration.lines(view, window_layout())
  vim.api.nvim_buf_set_extmark(buf, state.ns, first - 1, 0, {
    virt_lines = above,
    virt_lines_above = true,
    virt_lines_leftcol = true,
  })

  place_window(first, line_count, #above)
  return { new_file = new_file }
end

return M
