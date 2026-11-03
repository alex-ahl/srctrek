-- Draws one step in the editor: its lines tinted with a bar at the left edge, change signs, the
-- narration above it, an arrow at each line that leads to another step, and below it what
-- the code can't point at: calls with no line, and its context steps counted.
local inline_values = require("codetrail.inline_values")
local state = require("codetrail.state")
local text = require("codetrail.text")

local M = {}

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
  added = { text = "+", group = "CodetrailAdded" },
  changed = { text = "~", group = "CodetrailChanged" },
}

-- One sign per line, as the sign column shows one: the change's own lines carry theirs, the
-- step's other lines the bar, and its first line ▶ like a debugger's current line, followed by
-- that line's change sign if it has one.
local function signs(view, first, last)
  local by_line = {}
  for l = first, last do
    by_line[l] = { text = "▎", group = "CodetrailStepBar" }
  end
  for _, changed in ipairs(view.changed_lines) do
    by_line[changed.line] = CHANGE_SIGNS[changed.change]
  end
  local first_change = by_line[first].group == "CodetrailStepBar" and "" or by_line[first].text
  by_line[first] = { text = "▶" .. first_change, group = "CodetrailCurrent" }
  return by_line
end

local function mark_lines(buf, view, first, last)
  local line_count = vim.api.nvim_buf_line_count(buf)
  for l, sign in pairs(signs(view, first, last)) do
    if l <= line_count then
      local in_step = l >= first and l <= last
      vim.api.nvim_buf_set_extmark(buf, state.ns, l - 1, 0, {
        sign_text = sign.text,
        sign_hl_group = sign.group,
        line_hl_group = in_step and "CodetrailStep" or nil,
      })
    end
  end
end

-- The narration sits on a band across the window, from its left edge, so it reads as the
-- tour's commentary on the code rather than a line of it. Virtual lines don't wrap, so the text
-- is wrapped here, three lines at most; the full text is in details.
local function band_line(chunks, width)
  local used = 0
  for _, chunk in ipairs(chunks) do
    used = used + vim.fn.strdisplaywidth(chunk[1])
  end
  table.insert(chunks, { string.rep(" ", math.max(width - used, 0)), "CodetrailNarration" })
  return chunks
end

local function on_band(text_line, group)
  return { text_line, { "CodetrailNarration", group } }
end

local function wrapped(line, group, width)
  return vim.tbl_map(function(l)
    return { on_band("  " .. l, group) }
  end, text.wrap(line, width - 4, 3, "  "))
end

local function narration(view, width)
  local lines = wrapped(view.summary, "CodetrailNarration", width)
  if not view.changed then
    table.insert(lines[#lines], on_band("  unchanged", "CodetrailUnchanged"))
  end
  -- only a high flag shows inline; the rest are in details
  if view.flag ~= vim.NIL and view.flag.severity == "high" then
    vim.list_extend(lines, wrapped("⚠ " .. view.flag.note, "CodetrailFlagHigh", width))
  end
  return vim.tbl_map(function(chunks)
    return band_line(chunks, width)
  end, lines)
end

-- The line itself says what it calls; only a hop into another repo says where it goes.
local function marker(view, call)
  return call.repo == view.repo and "→" or ("↯ " .. call.repo)
end

local function calls_by_line(view)
  local lines = {}
  for _, call in ipairs(view.calls) do
    if call.call_line ~= vim.NIL then
      lines[call.call_line] = lines[call.call_line] or {}
      local markers = lines[call.call_line]
      if not vim.tbl_contains(markers, marker(view, call)) then
        table.insert(markers, marker(view, call))
      end
    end
  end
  return lines
end

local function mark_calls(buf, view, line_count)
  for line, markers in pairs(calls_by_line(view)) do
    if line <= line_count then
      vim.api.nvim_buf_set_extmark(buf, state.ns, line - 1, 0, {
        virt_text = { { "  " .. table.concat(markers, " "), "CodetrailCall" } },
        virt_text_pos = "eol",
        -- blended with the step's tint; on their own they'd sit in a block of the plain background
        hl_mode = "combine",
      })
    end
  end
end

local function uncited_calls(view)
  local uncited = vim.tbl_filter(function(call)
    return call.call_line == vim.NIL
  end, view.calls)
  if #uncited == 0 then
    return nil
  end
  return { { "→ " .. table.concat(vim.tbl_map(text.place, uncited), ", "), "CodetrailCall" } }
end

local function context_count(view)
  local count = #view.context
  if count == 0 then
    return nil
  end
  return { { count == 1 and "1 context step" or count .. " context steps", "CodetrailContext" } }
end

local function below(view)
  local lines = {}
  for _, line in ipairs({ uncited_calls(view) or false, context_count(view) or false }) do
    if line then
      table.insert(lines, line)
    end
  end
  return lines
end

local function window_width()
  return vim.api.nvim_win_get_width(vim.api.nvim_get_current_win())
end

function M.show(view)
  M.clear()
  vim.api.nvim_set_current_win(editor_window())
  vim.cmd("edit " .. vim.fn.fnameescape(view.path))
  local buf = vim.api.nvim_get_current_buf()
  local line_count = vim.api.nvim_buf_line_count(buf)
  local first, last = math.min(view.start_line, line_count), math.min(view.end_line, line_count)

  mark_lines(buf, view, first, last)
  mark_calls(buf, view, line_count)
  inline_values.show(buf, view.predicted_values, line_count)
  local above = narration(view, window_width())
  vim.api.nvim_buf_set_extmark(buf, state.ns, first - 1, 0, {
    virt_lines = above,
    virt_lines_above = true,
    virt_lines_leftcol = true,
  })
  local under = below(view)
  if #under > 0 then
    vim.api.nvim_buf_set_extmark(buf, state.ns, last - 1, 0, { virt_lines = under })
  end

  vim.api.nvim_win_set_cursor(0, { first, 0 })
  vim.cmd("normal! zz")
  -- virtual lines above the first line stay hidden unless the window is scrolled to show them
  if first == 1 then
    vim.fn.winrestview({ topline = 1, topfill = #above })
  end
end

return M
