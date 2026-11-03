-- The winbar over a step: its stop number, its place, and the call stack, newest frame first.
-- It stands in for the window's own winbar while the step is shown.
local text = require("codetrail.text")

local M = {}

local function escape(s)
  return (s:gsub("%%", "%%%%"))
end

local function coloured(group, s)
  return "%#" .. group .. "#" .. s .. "%*"
end

local function label(ref)
  return ref.name ~= vim.NIL and ref.name or text.place(ref)
end

-- A hop's frame is followed by what started it, so the separator after it says so.
local function stack_text(frames)
  local parts = {}
  for i = #frames, 1, -1 do
    local frame = frames[i]
    table.insert(parts, escape(label(frame)))
    if i > 1 then
      table.insert(parts, frame.hop and coloured("CodetrailHop", " ↯ ") or " ‹ ")
    end
  end
  return table.concat(parts)
end

local function position(view)
  local number = string.format("%d/%d", view.number, view.count)
  if view.step_kind == "context" then
    return number .. " context"
  end
  return number
end

-- How to get back to the step, as the away note says it: the key, or the command without one.
local return_hint = ":TrailCurrent"

function M.set_return_hint(hint)
  return_hint = hint
end

local function bar(view, away)
  local parts = {
    position(view),
    escape(view.repo .. "/" .. view.file .. ":" .. view.start_line),
  }
  if view.stale then
    table.insert(parts, coloured("CodetrailStale", "stale: file changed since"))
  end
  if away then
    table.insert(parts, coloured("CodetrailAway", "away · " .. escape(return_hint) .. " returns"))
  end
  if #view.stack > 0 then
    table.insert(parts, stack_text(view.stack))
  end
  -- the badge says a tour is on, as -- INSERT -- says a mode is
  return coloured("CodetrailBadge", " codetrail ") .. "  " .. table.concat(parts, "  ·  ")
end

-- The window showing the step, the step, and the window's own winbar to put back: the
-- window-local value, so a window that used the global winbar goes back to using it.
local shown = nil

local function own_winbar(win)
  return vim.api.nvim_get_option_value("winbar", { scope = "local", win = win })
end

local function set_winbar(win, value)
  vim.api.nvim_set_option_value("winbar", value, { scope = "local", win = win })
end

function M.restore()
  if shown and vim.api.nvim_win_is_valid(shown.win) then
    set_winbar(shown.win, shown.own)
  end
  shown = nil
end

function M.show(win, view)
  if shown == nil or shown.win ~= win then
    M.restore()
    shown = { win = win, own = own_winbar(win) }
  end
  shown.view, shown.away = view, false
  set_winbar(win, bar(view, false))
end

-- Away: the step's window shows another file, or its cursor is off the step's lines.
local function is_away(win, view)
  if vim.api.nvim_buf_get_name(vim.api.nvim_win_get_buf(win)) ~= view.path then
    return true
  end
  local line = vim.api.nvim_win_get_cursor(win)[1]
  return line < view.start_line or line > view.end_line
end

-- Says so in the winbar once the reader moves away from the step, and stops once they're back.
function M.follow_cursor()
  if shown == nil or shown.view == nil or not vim.api.nvim_win_is_valid(shown.win) then
    return
  end
  local away = is_away(shown.win, shown.view)
  if away ~= shown.away then
    shown.away = away
    set_winbar(shown.win, bar(shown.view, away))
  end
end

return M
