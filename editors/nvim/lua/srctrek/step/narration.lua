-- The narration over a step: its summary on a band across the window, the hints a reader stepping
-- with next alone mustn't miss, and a high flag's note.
local FLAGS = require("srctrek.flags")
local text = require("srctrek.text")

local M = {}

-- The narration sits on a band across the window, from its left edge, so it reads as the
-- trek's commentary on the code rather than a line of it. Virtual lines don't wrap, so the text
-- is wrapped here, at a width that reads easily however wide the window is.
local READABLE_WIDTH = 90
local MAX_LINES = 6

local function display_width(chunks)
  local width = 0
  for _, chunk in ipairs(chunks) do
    width = width + vim.fn.strdisplaywidth(chunk[1])
  end
  return width
end

-- `layout` is the window's: its `width`, and `indent`, the columns before the code (signs, line
-- numbers), so the narration starts where the code does.
local function band_line(chunks, layout)
  local rest = math.max(layout.width - display_width(chunks), 0)
  table.insert(chunks, { string.rep(" ", rest), "SrctrekNarration" })
  return chunks
end

local function on_band(text_line, group)
  return { text_line, { "SrctrekNarration", group } }
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
    return { edge("▌", "SrctrekBandEdge", layout), on_band(l, group) }
  end, text.wrap(line, text_width(layout), MAX_LINES, ""))
end


-- Where next goes from here, in words, so the reader knows before pressing it.
local function where_next(view)
  local next = view.next
  if next.how == "end" then
    return "next: the end of the trek"
  end
  local to = text.name_or_place(next.to)
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
  -- a high flag shows its note in full instead
  local flag = view.flag ~= vim.NIL and view.flag.severity ~= "high" and FLAGS[view.flag.severity]
  if flag then
    table.insert(found, { flag.label, flag.group })
  end
  if view.step_kind ~= "context" then
    table.insert(found, { where_next(view), "SrctrekUnchanged" })
  end
  return found
end

-- The hints after the summary, on its last line, or a line of their own when they don't fit.
local function add_extras(lines, extras, layout)
  if #extras == 0 then
    return
  end
  local chunks = {}
  for i, extra in ipairs(extras) do
    table.insert(chunks, on_band(i == 1 and "  " or "  ·  ", "SrctrekUnchanged"))
    table.insert(chunks, on_band(extra[1], extra[2]))
  end
  local last = lines[#lines]
  if display_width(last) + display_width(chunks) > layout.indent + text_width(layout) then
    last = { edge("▌", "SrctrekBandEdge", layout) }
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
    { "▖", "SrctrekBandPadEdge" },
    { string.rep("▄", rest), "SrctrekBandPad" },
  })
  table.insert(lines, {
    { "▘", "SrctrekBandPadEdgeStep" },
    { string.rep("▀", rest), "SrctrekBandPadStep" },
  })
  return lines
end

function M.lines(view, layout)
  local lines = wrapped(view.summary, "SrctrekNarration", layout)
  add_extras(lines, hints(view), layout)
  -- only a high flag shows inline; the rest are hinted at, and in details
  if view.flag ~= vim.NIL and view.flag.severity == "high" then
    vim.list_extend(lines, wrapped("⚠ " .. view.flag.note, "SrctrekFlagHigh", layout))
  end
  return vim.tbl_map(function(chunks)
    return band_line(chunks, layout)
  end, padded(lines, layout))
end

return M
