-- The winbar over a step: its stop number, its place, and the call stack, newest frame first.
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

function M.text(view)
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

return M
