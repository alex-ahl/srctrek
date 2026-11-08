-- The step's context code (contracts, types, where its data came from) in a float over the
-- step, each piece under its reason. The tour stays where it is, so q is the way back; enter on
-- a piece opens it as a step of its own.
local popup = require("srctrek.popup")
local server = require("srctrek.server")
local state = require("srctrek.state")
local text = require("srctrek.text")

local M = {}

-- Where the piece lives, in full: its repo and its path there, so it can be found without the tour.
local function label(ref)
  -- "repo: path", so the repo doesn't read as a folder
  local place = string.format("%s: %s:%d", ref.repo, ref.file, ref.start_line)
  return ref.name ~= vim.NIL and (ref.name .. " · " .. place) or place
end

local function code_of(ref)
  local ok, lines = pcall(vim.fn.readfile, ref.path)
  if not ok then
    return { "(" .. ref.path .. " can't be read)" }
  end
  return vim.list_slice(lines, ref.start_line, ref.end_line)
end

-- Every piece's code, one after another, and where each starts; a blank line ends the float, as
-- one opens it, for room against the border.
local function pieces(context)
  local lines, starts = {}, {}
  for i, ref in ipairs(context) do
    if i > 1 then
      table.insert(lines, "")
    end
    starts[#lines + 1] = ref
    vim.list_extend(lines, code_of(ref))
  end
  table.insert(lines, "")
  return lines, starts
end

-- The reason above each piece, as the band is above a step; virtual lines don't wrap, so the
-- reason is wrapped here to the float's width.
local function reason_lines(ref, width)
  local lines = { { { "" } } }
  vim.list_extend(lines, vim.tbl_map(function(line)
    return { { "▌ ", "SrctrekBandEdge" }, { line, "SrctrekNarration" } }
  end, text.wrap(ref.summary, width - 2, 6, "")))
  table.insert(lines, { { "  " .. label(ref), "SrctrekUnchanged" } })
  table.insert(lines, { { "" } })
  return lines
end

local function mark_reasons(buf, starts, width)
  for line, ref in pairs(starts) do
    vim.api.nvim_buf_set_extmark(buf, state.ns, line - 1, 0, {
      virt_lines = reason_lines(ref, width),
      virt_lines_above = true,
    })
  end
end

-- The piece the cursor is in: the last one starting at or above it.
local function piece_at(starts, line)
  local found, from = nil, 0
  for start, ref in pairs(starts) do
    if start <= line and start > from then
      found, from = ref, start
    end
  end
  return found
end

-- navigation draws views, so it's required when first used
local function open_as_step(ref)
  server.request("goto", { step = ref.id }, require("srctrek.navigation").show)
end

function M.show()
  local view = state.view
  if view.kind ~= "step" or #view.context == 0 then
    vim.api.nvim_echo({ { "srctrek: no context code for this step" } }, true, {})
    return
  end

  local lines, starts = pieces(view.context)
  -- code reads best with room around it, so this float is larger than the others
  local buf = popup.float(lines, string.format("context · stop %d", view.number), 0.9)
  vim.bo[buf].filetype = vim.filetype.match({ filename = view.context[1].path }) or ""
  local win = vim.api.nvim_get_current_win()
  mark_reasons(buf, starts, vim.api.nvim_win_get_width(win))
  popup.fit(win, 0.6)
  -- virtual lines above a window's first line show only when it's scrolled to show them
  local first = starts[1]
  vim.fn.winrestview({ topline = 1, topfill = #reason_lines(first, vim.api.nvim_win_get_width(win)) })
  vim.keymap.set("n", "<cr>", function()
    local ref = piece_at(starts, vim.api.nvim_win_get_cursor(0)[1])
    if ref then
      open_as_step(ref)
    end
  end, { buffer = buf })
end

return M
