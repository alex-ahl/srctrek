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

local function bar(view)
  local parts = {
    " codetrail",
    position(view),
    escape(view.repo .. "/" .. view.file .. ":" .. view.start_line),
  }
  if view.stale then
    table.insert(parts, coloured("CodetrailStale", "stale: file changed since"))
  end
  if #view.stack > 0 then
    table.insert(parts, stack_text(view.stack))
  end
  return table.concat(parts, "  ·  ")
end

-- The window showing the step, and its own winbar to put back: the window-local value, so a
-- window that used the global winbar goes back to using it.
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
  set_winbar(win, bar(view))
end

return M
