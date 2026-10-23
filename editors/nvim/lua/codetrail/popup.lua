-- Centred popups for overview, details, answers and the end screen.
local state = require("codetrail.state")

local M = {}

function M.float(lines, title)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  local width = math.min(110, math.floor(vim.o.columns * 0.8))
  -- height in screen rows: long lines wrap, so count each one's wrapped rows
  local rows = 0
  for _, l in ipairs(lines) do
    rows = rows + math.max(1, math.ceil(vim.fn.strdisplaywidth(l) / (width - 6)))
  end
  local height = math.min(rows, math.floor(vim.o.lines * 0.8))
  vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = math.floor((vim.o.lines - height) / 2) - 1,
    col = math.floor((vim.o.columns - width) / 2),
    border = "rounded",
    title = " " .. (title or "codetrail") .. " ",
  })
  vim.wo.wrap = true
  vim.wo.linebreak = true
  state.bind_keys(buf)
  vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = buf })
  vim.keymap.set("n", "<esc>", "<cmd>close<cr>", { buffer = buf })
  return buf
end

-- A citation reads <repo>/<path>:<line>; the repo name picks the root.
local function jump_to_citation()
  local word = vim.fn.expand("<cWORD>")
  local repo, path, line = word:match("([%w_%-%.]+)/([%w_%-%./]+%.%w+):(%d+)")
  local root = repo and state.roots[repo]
  if not root or vim.fn.filereadable(root .. "/" .. path) == 0 then
    return
  end
  vim.cmd("close")
  vim.cmd("edit " .. vim.fn.fnameescape(root .. "/" .. path))
  vim.api.nvim_win_set_cursor(0, { tonumber(line), 0 })
  vim.cmd("normal! zz")
end

-- A popup rendered as markdown, with citations underlined; enter on one jumps there.
function M.markdown(lines, title)
  local buf = M.float(lines, title)
  vim.bo[buf].filetype = "markdown"
  vim.wo.conceallevel = 2
  local names = vim.tbl_map(function(n)
    return vim.fn.escape(n, [[\.]])
  end, vim.tbl_keys(state.roots))
  vim.fn.matchadd("CodetrailCitation", [[\v<(]] .. table.concat(names, "|") .. [[)/[[:alnum:]_./-]+:\d+]])
  vim.keymap.set("n", "<cr>", jump_to_citation, { buffer = buf })
  return buf
end

return M
