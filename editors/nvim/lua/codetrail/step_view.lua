-- Draws one step in the editor: its lines tinted with a bar at the left edge, change signs, the
-- narration above it, and an arrow at each line that leads to another step.
local inline_values = require("codetrail.inline_values")
local origin = require("codetrail.origin")
local state = require("codetrail.state")
local text = require("codetrail.text")

local M = {}

-- The tour's copies whose diagnostics are hidden, to show again when the tour ends.
local quieted = {}

-- A copy in trail's cache has no dependencies installed, so a language server flags every import;
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
      -- the step's tint runs under its signs and line numbers too, from the window's left edge
      vim.api.nvim_buf_set_extmark(buf, state.ns, l - 1, 0, {
        sign_text = sign.text,
        sign_hl_group = in_step and (sign.group .. "InStep") or sign.group,
        line_hl_group = in_step and "CodetrailStep" or nil,
        number_hl_group = in_step and "CodetrailStepNumber" or nil,
      })
    end
  end
end

-- The narration sits on a band across the window, from its left edge, so it reads as the
-- tour's commentary on the code rather than a line of it. Virtual lines don't wrap, so the text
-- is wrapped here, at a width that reads easily however wide the window is.
local READABLE_WIDTH = 90
local MAX_LINES = 6

-- `layout` is the window's: its `width`, and `indent`, the columns before the code (signs, line
-- numbers), so the narration starts where the code does.
local function band_line(chunks, layout)
  local used = 0
  for _, chunk in ipairs(chunks) do
    used = used + vim.fn.strdisplaywidth(chunk[1])
  end
  table.insert(chunks, { string.rep(" ", math.max(layout.width - used, 0)), "CodetrailNarration" })
  return chunks
end

local function on_band(text_line, group)
  return { text_line, { "CodetrailNarration", group } }
end

-- Each band line starts with an edge in the left margin, as a callout's does, and its text in the
-- code's first column.
local function edge(mark, group, layout)
  return on_band(mark .. string.rep(" ", math.max(layout.indent - 1, 1)), group)
end

local function text_width(layout)
  return math.min(layout.width - layout.indent - 2, READABLE_WIDTH)
end

local function wrapped(line, group, layout)
  return vim.tbl_map(function(l)
    return { edge("▌", "CodetrailBandEdge", layout), on_band(l, group) }
  end, text.wrap(line, text_width(layout), MAX_LINES, ""))
end

local FLAG_HINTS = {
  medium = { "● risky", "CodetrailFlagMedium" },
  low = { "● worth knowing", "CodetrailFlagLow" },
}

local function next_label(ref)
  return ref.name ~= vim.NIL and ref.name or text.place(ref)
end

-- Where next goes from here, in words, so the reader knows before pressing it.
local function where_next(view)
  local next = view.next
  if next.how == "end" then
    return "next: the end of the tour"
  end
  local to = next_label(next.to)
  if next.how == "into" then
    return "next: into " .. to .. (next.line ~= vim.NIL and (", line " .. next.line) or "")
  elseif next.how == "hop" then
    -- a hop names its repo only when it leaves this one
    local repo = next.to.repo ~= view.repo and (next.to.repo .. ": ") or ""
    return "next: ↯ " .. repo .. to
  elseif next.how == "back" then
    return "next: back to " .. to
  end
  return "next: " .. to
end

-- What a reader stepping with next alone mustn't miss beyond the narration: a risky or
-- worth-knowing flag, and where next goes.
local function hints(view)
  local found = {}
  local flag = view.flag ~= vim.NIL and FLAG_HINTS[view.flag.severity]
  if flag then
    table.insert(found, flag)
  end
  if view.step_kind ~= "context" then
    table.insert(found, { where_next(view), "CodetrailUnchanged" })
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

-- The hints after the summary, on its last line, or a line of their own when they don't fit.
local function add_extras(lines, extras, layout)
  if #extras == 0 then
    return
  end
  local chunks = {}
  for i, extra in ipairs(extras) do
    table.insert(chunks, on_band(i == 1 and "  " or "  ·  ", "CodetrailUnchanged"))
    table.insert(chunks, on_band(extra[1], extra[2]))
  end
  local last = lines[#lines]
  if display_width(last) + display_width(chunks) > layout.indent + text_width(layout) then
    last = { edge("▌", "CodetrailBandEdge", layout) }
    table.insert(lines, last)
  end
  vim.list_extend(last, chunks)
end

-- Half a row of room above and below the text: a terminal row can't be split, so each padding row
-- is half filled in the band's colour, ▄ above and ▀ below. Below, the other half takes the step's
-- tint, which runs under the gutter too, so the band runs into its code.
-- The edge carries on through both, as a quarter block: a cell holds only two colours.
local function padded(lines, layout)
  local rest = layout.width - 1
  table.insert(lines, 1, {
    { "▖", "CodetrailBandPadEdge" },
    { string.rep("▄", rest), "CodetrailBandPad" },
  })
  table.insert(lines, {
    { "▘", "CodetrailBandPadEdgeStep" },
    { string.rep("▀", rest), "CodetrailBandPadStep" },
  })
  return lines
end

local function narration(view, layout)
  local lines = wrapped(view.summary, "CodetrailNarration", layout)
  add_extras(lines, hints(view), layout)
  -- only a high flag shows inline; the rest are hinted at, and in details
  if view.flag ~= vim.NIL and view.flag.severity == "high" then
    vim.list_extend(lines, wrapped("⚠ " .. view.flag.note, "CodetrailFlagHigh", layout))
  end
  return vim.tbl_map(function(chunks)
    return band_line(chunks, layout)
  end, padded(lines, layout))
end

-- The line itself says what it calls; only a hop into another repo says where it goes, and a
-- link matched only by name gets a ?, since the tour can't prove this line makes the call.
local function marker(view, call)
  local arrow = call.repo == view.repo and "→" or ("↯ " .. call.repo)
  return call.guessed and (arrow .. "?") or arrow
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

-- The line next enters from, so its arrow can stand out from the others.
local function next_line(view)
  local next = view.next
  return (next.how == "into" or next.how == "hop") and next.line ~= vim.NIL and next.line or nil
end

local function mark_calls(buf, view, line_count)
  local leads_next = next_line(view)
  for line, markers in pairs(calls_by_line(view)) do
    if line <= line_count then
      local group = line == leads_next and "CodetrailCallNext" or "CodetrailCall"
      vim.api.nvim_buf_set_extmark(buf, state.ns, line - 1, 0, {
        virt_text = { { "  " .. table.concat(markers, " "), group } },
        virt_text_pos = "eol",
        -- blended with the step's tint; on their own they'd sit in a block of the plain background
        hl_mode = "combine",
        priority = state.EOL_PRIORITY,
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
  -- the tour's copy lives in trail's cache, where an edit would be lost
  if view.tour_copy then
    vim.bo[buf].readonly = true
    vim.bo[buf].modifiable = false
    quiet_diagnostics(buf)
  end
  local line_count = vim.api.nvim_buf_line_count(buf)
  local first, last = math.min(view.start_line, line_count), math.min(view.end_line, line_count)

  local new_file = is_new_file(view, line_count)
  mark_lines(buf, view, first, last, new_file)
  mark_calls(buf, view, line_count)
  inline_values.show(buf, view.predicted_values, line_count)
  local above = narration(view, window_layout())
  vim.api.nvim_buf_set_extmark(buf, state.ns, first - 1, 0, {
    virt_lines = above,
    virt_lines_above = true,
    virt_lines_leftcol = true,
  })

  place_window(first, line_count, #above)
  return { new_file = new_file }
end

return M
