-- Drives the Neovim plugin as a user would, for nvim.test.ts: runs each action in
-- $DRIVE_ACTIONS (comma-separated; "start:<tour>" opens one), waits for the server's answer, and
-- writes what the screen shows after each to $DRIVE_OUT as JSON.
local codetrail = require("codetrail")
local state = require("codetrail.state")

vim.g.codetrail = { cmd = vim.json.decode(vim.env.DRIVE_CMD) }

local notices = {}
vim.notify = function(message)
  table.insert(notices, message)
end

local function editor_window()
  for _, win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
    if vim.api.nvim_win_get_config(win).relative == "" then
      return win
    end
  end
end

local function marks(buf, ns)
  return vim.api.nvim_buf_get_extmarks(buf, ns, 0, -1, { details = true })
end

local function texts(chunks_list)
  return vim.tbl_map(function(chunks)
    return table.concat(vim.tbl_map(function(chunk)
      return chunk[1]
    end, chunks))
  end, chunks_list)
end

local function screen()
  local win = editor_window()
  local buf = vim.api.nvim_win_get_buf(win)
  local current = vim.api.nvim_get_current_win()
  local floating = vim.api.nvim_win_get_config(current).relative ~= ""
  local seen = { virt_lines = {}, values = {}, signs = {} }
  for _, mark in ipairs(marks(buf, state.ns)) do
    local line, details = mark[2] + 1, mark[4]
    if details.virt_lines then
      vim.list_extend(seen.virt_lines, texts(details.virt_lines))
    end
    if details.sign_text then
      table.insert(seen.signs, { line = line, text = vim.trim(details.sign_text) })
    end
  end
  for _, mark in ipairs(marks(buf, state.values_ns)) do
    table.insert(seen.values, { line = mark[2] + 1, text = texts({ mark[4].virt_text })[1] })
  end
  table.sort(seen.signs, function(a, b)
    return a.line < b.line
  end)

  return {
    view = state.view and state.view.kind or vim.NIL,
    file = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(buf), ":t"),
    line = vim.api.nvim_win_get_cursor(win)[1],
    winbar = vim.wo[win].winbar,
    float = floating and vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(current), 0, -1, false) or vim.NIL,
    virt_lines = seen.virt_lines,
    values = seen.values,
    signs = seen.signs,
    notices = vim.list_slice(notices),
  }
end

local function run(action)
  local view, notified = state.view, #notices
  local tour = action:match("^start:(.+)$")
  if tour then
    codetrail.start(tour)
  else
    codetrail[action]()
  end
  if action ~= "quit" and action ~= "details" and action ~= "values" then
    vim.wait(15000, function()
      return state.view ~= view or #notices > notified
    end, 20)
  end
end

-- An error is written out in place of the screens, so the test fails with it rather than wait.
local ok, result = pcall(function()
  local screens = {}
  for action in vim.env.DRIVE_ACTIONS:gmatch("[^,]+") do
    run(action)
    table.insert(screens, screen())
  end
  return screens
end)
vim.fn.writefile({ vim.json.encode(ok and result or { error = tostring(result) }) }, vim.env.DRIVE_OUT)
vim.cmd("qa!")
