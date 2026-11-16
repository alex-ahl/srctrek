-- An arrow at the end of each line that leads to another step.
local state = require("srctrek.state")

local M = {}

-- The line itself says what it calls; only a hop into another repo says where it goes, and a
-- link matched only by name gets a ?, since the trek can't prove this line makes the call.
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

function M.show(buf, view, line_count)
  local leads_next = next_line(view)
  for line, markers in pairs(calls_by_line(view)) do
    if line <= line_count then
      local group = line == leads_next and "SrctrekCallNext" or "SrctrekCall"
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

return M
