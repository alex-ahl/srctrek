-- A popup's document: its lines, each one's colour, and what enter does on it.
local popup = require("srctrek.popup")
local server = require("srctrek.server")

local M = {}

function M.new()
  local doc = { lines = {}, groups = {}, actions = {} }
  function doc.add(line, action, group)
    table.insert(doc.lines, line)
    doc.actions[#doc.lines] = action
    doc.groups[#doc.lines] = group
  end
  function doc.extend(lines)
    for _, line in ipairs(lines) do
      doc.add(line)
    end
  end
  return doc
end

-- navigation draws views and opens the details' popups, so it's required when first used
function M.go_to(id)
  return function()
    server.request("goto", { step = id }, require("srctrek.navigation").show)
  end
end

function M.open_at(path, line)
  return function()
    popup.close()
    vim.cmd("edit " .. vim.fn.fnameescape(path))
    vim.api.nvim_win_set_cursor(0, { line, 0 })
    vim.cmd("normal! zz")
  end
end

return M
