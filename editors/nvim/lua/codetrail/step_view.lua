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

-- Each band line starts with an edge in the info colour, as a callout's does.
local function wrapped(line, group, width)
  return vim.tbl_map(function(l)
    return { on_band("▌ ", "CodetrailBandEdge"), on_band(l, group) }
  end, text.wrap(line, width - 4, 3, "  "))
end

local function tag(view, new_file)
  if new_file then
    return { "new file", "CodetrailUnchanged" }
  end
  return not view.changed and { "unchanged", "CodetrailUnchanged" } or nil
end

local FLAG_HINTS = {
  medium = { "● risky", "CodetrailFlagMedium" },
  low = { "● worth knowing", "CodetrailFlagLow" },
}

-- A context step as the band names it: in this file, by where to look; elsewhere, by place.
local function context_label(view, ref)
  local name = ref.name ~= vim.NIL and ref.name or nil
  if ref.path == view.path then
    local inside = ref.start_line >= view.start_line and ref.start_line <= view.end_line
    local way = inside and "in this step" or (ref.start_line < view.start_line and "above" or "below")
    return (name or ("line " .. ref.start_line)) .. ", " .. way
  end
  return name and (name .. " · " .. text.place(ref)) or text.place(ref)
end

-- What a reader stepping with next alone mustn't miss: a risky or worth-knowing flag, and the
-- context steps that explain this one. The rest is in details.
local function hints(view)
  local found = {}
  if view.flag ~= vim.NIL and FLAG_HINTS[view.flag.severity] then
    table.insert(found, FLAG_HINTS[view.flag.severity])
  end
  for _, ref in ipairs(view.context) do
    table.insert(found, { "◇ " .. context_label(view, ref), "CodetrailContext" })
  end
  return found
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
  if display_width(last) + display_width(chunks) > width then
    last = { on_band("▌ ", "CodetrailBandEdge") }
    table.insert(lines, last)
  end
  vim.list_extend(last, chunks)
end

local function narration(view, width, new_file)
  local lines = wrapped(view.summary, "CodetrailNarration", width)
  local extras = vim.list_extend({ tag(view, new_file) }, hints(view))
  add_extras(lines, extras, width)
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
  local above = narration(view, window_width(), new_file)
  vim.api.nvim_buf_set_extmark(buf, state.ns, first - 1, 0, {
    virt_lines = above,
    virt_lines_above = true,
    virt_lines_leftcol = true,
  })

  place_window(first, line_count, #above)
end

return M
