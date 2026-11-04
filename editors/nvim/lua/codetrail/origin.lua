-- What the user had in each window the tour draws in, kept whole while the tour runs and put
-- back when it ends.
local M = {}

local before = {} -- window -> { buf, view } as the user had it
local bufhidden = {} -- buffer -> its own 'bufhidden', while the tour keeps it loaded

-- With 'hidden' off, showing another file unloads a buffer, and its undo history with it, or
-- refuses when it has unsaved changes; 'bufhidden' hide keeps it loaded either way.
local function keep_loaded(buf)
  if bufhidden[buf] == nil then
    bufhidden[buf] = vim.bo[buf].bufhidden
    vim.bo[buf].bufhidden = "hide"
  end
end

-- Called before a step opens its file in `win`.
function M.keep(win)
  local buf = vim.api.nvim_win_get_buf(win)
  keep_loaded(buf)
  if before[win] == nil then
    before[win] = { buf = buf, view = vim.api.nvim_win_call(win, vim.fn.winsaveview) }
  end
end

function M.restore()
  for win, shown in pairs(before) do
    if vim.api.nvim_win_is_valid(win) and vim.api.nvim_buf_is_valid(shown.buf) then
      vim.api.nvim_win_set_buf(win, shown.buf)
      vim.api.nvim_win_call(win, function()
        vim.fn.winrestview(shown.view)
      end)
    end
  end
  for buf, value in pairs(bufhidden) do
    if vim.api.nvim_buf_is_valid(buf) then
      vim.bo[buf].bufhidden = value
    end
  end
  before, bufhidden = {}, {}
end

return M
