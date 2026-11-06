-- The winbar over a step: its stop number, its place, and the call stack.
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

-- A frame after a hop into another repo names that repo, so web and api don't read as one program.
local function frame_text(frame, previous)
  local crossed = frame.hop and previous ~= nil and previous.repo ~= frame.repo
  return escape((crossed and (frame.repo .. ": ") or "") .. label(frame))
end

-- What started a stack that begins at a hop nobody waits on: shown dimmed, as it isn't running.
local function cause_of(view)
  return view.started_by ~= vim.NIL and view.started_by or nil
end

-- Named with its repo only when that isn't the repo of the stack it started.
local function started_by_text(view)
  local cause = cause_of(view)
  if cause == nil then
    return ""
  end
  local first = view.stack[1]
  local repo = (first == nil or first.repo ~= cause.repo) and (cause.repo .. ": ") or ""
  return coloured("CodetrailHop", "started by " .. escape(repo .. label(cause)) .. " ↯ ")
end

-- Outermost first, as a path reads, with ↯ before the frame a hop started. Cut from the left
-- when the window is narrow (%<), so the step's own frame stays in view.
local function stack_text(view)
  local parts = {}
  for i, frame in ipairs(view.stack) do
    if i > 1 then
      table.insert(parts, frame.hop and coloured("CodetrailHop", " ↯ ") or " › ")
    end
    -- the first frame of a fresh stack follows its cause; frames below the step's are dimmed
    local previous = view.stack[i - 1] or cause_of(view)
    local shown = frame_text(frame, previous)
    table.insert(parts, i == #view.stack and shown or coloured("CodetrailStackFrame", shown))
  end
  return "%<" .. started_by_text(view) .. table.concat(parts)
end

local function position(view)
  local number = coloured("CodetrailPosition", string.format("%d/%d", view.number, view.count))
  if view.step_kind == "context" then
    return number .. " context"
  end
  return number
end

-- What kind of code the step is, beside its number: code the change adds whole, or existing code
-- the flow passes through; code the change edits needs no word, its signs show it.
local function code_tag(view, new_file)
  if new_file then
    return "new file"
  end
  return not view.changed and "existing code" or nil
end

-- "repo: path", as the context float writes it, so the repo doesn't read as a folder; the full
-- path is in the status line, so the stack gets the room.
local function place_text(view)
  return coloured("CodetrailRepo", escape(view.repo)) .. ": " .. escape(text.place(view))
end

local function tags(view, new_file)
  local found = {}
  local tag = code_tag(view, new_file)
  if tag then
    table.insert(found, coloured("CodetrailUnchanged", tag))
  end
  if #view.context > 0 then
    table.insert(found, coloured("CodetrailContext", "context available"))
  end
  if view.tour_copy then
    table.insert(found, coloured("CodetrailTourCopy", "tour's version"))
  end
  if view.stale then
    table.insert(found, coloured("CodetrailStale", "stale: file changed since"))
  end
  return found
end

local function bar(view, away, new_file)
  local parts = { position(view) }
  vim.list_extend(parts, tags(view, new_file))
  table.insert(parts, place_text(view))
  if #view.stack > 0 then
    table.insert(parts, stack_text(view))
  end
  -- at the right end (%=), so it doesn't shift the rest; the key back is in the overview
  local away_text = away and ("  %=" .. coloured("CodetrailAway", "away") .. " ") or ""
  -- the badge says a tour is on, as -- INSERT -- says a mode is
  local separator = coloured("CodetrailSeparator", "  │  ")
  local badge = coloured("CodetrailBadge", " codetrail ")
  return badge .. "  " .. table.concat(parts, separator) .. away_text
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

function M.show(win, view, new_file)
  if shown == nil or shown.win ~= win then
    M.restore()
    shown = { win = win, own = own_winbar(win) }
  end
  shown.view, shown.away, shown.new_file = view, false, new_file
  set_winbar(win, bar(view, false, new_file))
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
    set_winbar(shown.win, bar(shown.view, away, shown.new_file))
  end
end

return M
