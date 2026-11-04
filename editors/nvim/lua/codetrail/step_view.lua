-- Draws one step in the editor: its lines tinted with a bar at the left edge, change signs, the
-- narration above it, and an arrow at each line that leads to another step.
local inline_values = require("codetrail.inline_values")
local origin = require("codetrail.origin")
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
local function signs(view, first, last, new_file)
  local by_line = {}
  for l = first, last do
    by_line[l] = { text = "▎", group = "CodetrailStepBar" }
  end
  for _, changed in ipairs(new_file and {} or view.changed_lines) do
    by_line[changed.line] = CHANGE_SIGNS[changed.change]
  end
  local first_change = by_line[first].group == "CodetrailStepBar" and "" or by_line[first].text
  by_line[first] = { text = "▶" .. first_change, group = "CodetrailCurrent" }
  return by_line
end

local function mark_lines(buf, view, first, last, new_file)
  local line_count = vim.api.nvim_buf_line_count(buf)
  for l, sign in pairs(signs(view, first, last, new_file)) do
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
-- is wrapped here, at a width that reads easily however wide the window is.
local READABLE_WIDTH = 90
local MAX_LINES = 6

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

-- Each band line starts with an edge in the info colour, as a callout's does.
local function text_width(width)
  return math.min(width - 4, READABLE_WIDTH)
end

local function wrapped(line, group, width)
  return vim.tbl_map(function(l)
    return { on_band("▌ ", "CodetrailBandEdge"), on_band(l, group) }
  end, text.wrap(line, text_width(width), MAX_LINES, ""))
end

local FLAG_HINTS = {
  medium = { "● risky", "CodetrailFlagMedium" },
  low = { "● worth knowing", "CodetrailFlagLow" },
}

-- What a reader stepping with next alone mustn't miss beyond the narration: a risky or
-- worth-knowing flag. Background code is named in the narration itself; details list it.
local function hints(view)
  local flag = view.flag ~= vim.NIL and FLAG_HINTS[view.flag.severity]
  return flag and { flag } or {}
end

local function display_width(chunks)
  local width = 0
  for _, chunk in ipairs(chunks) do
    width = width + vim.fn.strdisplaywidth(chunk[1])
  end
  return width
end

-- The tags and hints after the summary, on its last line, or a line of their own when they
-- don't fit there.
local function add_extras(lines, extras, width)
  if #extras == 0 then
    return
  end
  local chunks = {}
  for i, extra in ipairs(extras) do
    table.insert(chunks, on_band(i == 1 and "  " or "  ·  ", "CodetrailUnchanged"))
    table.insert(chunks, on_band(extra[1], extra[2]))
  end
  local last = lines[#lines]
  if display_width(last) + display_width(chunks) > text_width(width) + 2 then
    last = { on_band("▌ ", "CodetrailBandEdge") }
    table.insert(lines, last)
  end
  vim.list_extend(last, chunks)
end

local function narration(view, width)
  local lines = wrapped(view.summary, "CodetrailNarration", width)
  add_extras(lines, hints(view), width)
  -- only a high flag shows inline; the rest are hinted at, and in details
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

local function window_width()
  return vim.api.nvim_win_get_width(vim.api.nvim_get_current_win())
end

function M.show(view)
  M.clear()
  local win = editor_window()
  origin.keep(win)
  vim.api.nvim_set_current_win(win)
  vim.cmd("edit " .. vim.fn.fnameescape(view.path))
  local buf = vim.api.nvim_get_current_buf()
  -- the tour's copy lives in trail's cache, where an edit would be lost
  if view.tour_copy then
    vim.bo[buf].readonly = true
    vim.bo[buf].modifiable = false
  end
  local line_count = vim.api.nvim_buf_line_count(buf)
  local first, last = math.min(view.start_line, line_count), math.min(view.end_line, line_count)

  local new_file = is_new_file(view, line_count)
  mark_lines(buf, view, first, last, new_file)
  mark_calls(buf, view, line_count)
  inline_values.show(buf, view.predicted_values, line_count)
  local above = narration(view, window_width())
  vim.api.nvim_buf_set_extmark(buf, state.ns, first - 1, 0, {
    virt_lines = above,
    virt_lines_above = true,
    virt_lines_leftcol = true,
  })

  place_window(first, line_count, #above)
  return { new_file = new_file }
end

return M
