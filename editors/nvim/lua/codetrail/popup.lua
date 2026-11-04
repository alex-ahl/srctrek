-- Centred popups for overview, details, answers and the end screen.
local state = require("codetrail.state")

local M = {}

-- The popups open now, so a move closes its own and never another plugin's float.
local open = {}

function M.close()
  for _, win in ipairs(open) do
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end
  open = {}
end

-- Sizes a popup to its lines as they wrap in the window, virtual lines included, which only the
-- window itself can measure, and at least `min_height` of the screen; again after anything is
-- added to it.
function M.fit(win, min_height)
  local width = vim.api.nvim_win_get_width(win)
  local wanted = math.max(vim.api.nvim_win_text_height(win, {}).all, math.floor(vim.o.lines * (min_height or 0)))
  local height = math.min(wanted, math.floor(vim.o.lines * 0.8))
  vim.api.nvim_win_set_config(win, {
    relative = "editor",
    height = height,
    row = math.floor((vim.o.lines - height) / 2) - 1,
    col = math.floor((vim.o.columns - width) / 2),
  })
end

-- Opened one row high, then fitted to its lines; `width` is a share of the screen, capped for
-- reading unless given.
function M.float(lines, title, width_share)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  local width = width_share and math.floor(vim.o.columns * width_share)
    or math.min(140, math.floor(vim.o.columns * 0.9))
  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = 1,
    row = 0,
    col = math.floor((vim.o.columns - width) / 2),
    border = "rounded",
    title = " " .. (title or "codetrail") .. " ",
  })
  table.insert(open, win)
  vim.wo.wrap = true
  vim.wo.linebreak = true
  -- a column of space inside the border on the left, so text doesn't sit against it
  vim.wo.foldcolumn = "1"
  -- room left below the text stays blank rather than filled with ~
  vim.wo.fillchars = "eob: "
  M.fit(win)
  vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = buf })
  vim.keymap.set("n", "<esc>", "<cmd>close<cr>", { buffer = buf })
  return buf
end

-- A popup of plain lines, coloured by line, where enter runs a line's action:
-- doc = { lines, groups = { [line] = group }, actions = { [line] = function } }.
function M.document(doc, title)
  local buf = M.float(doc.lines, title)
  for line, group in pairs(doc.groups) do
    vim.api.nvim_buf_set_extmark(buf, state.ns, line - 1, 0, { end_row = line, hl_group = group, hl_eol = false })
  end
  vim.keymap.set("n", "<cr>", function()
    local action = doc.actions[vim.api.nvim_win_get_cursor(0)[1]]
    if action then
      action()
    end
  end, { buffer = buf })
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
