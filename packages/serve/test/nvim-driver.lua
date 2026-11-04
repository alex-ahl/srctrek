-- Drives the Neovim plugin as a user would, for nvim.test.ts: runs each action in
-- $DRIVE_ACTIONS (comma-separated; "start:<tour>" opens one, "cursor:<line>" moves the cursor,
-- "winbar:<text>" sets the window's own winbar, "userfloat" opens another plugin's float,
-- "edit:<file>" opens a file of the user's own, "type:<text>" replaces its first line unsaved,
-- "nohidden" turns 'hidden' off), waits
-- for the server's answer, and writes what the screen shows after each to $DRIVE_OUT as JSON.
local codetrail = require("codetrail")
local state = require("codetrail.state")

vim.g.codetrail = { cmd = vim.json.decode(vim.env.DRIVE_CMD) }

local notices = {}
vim.notify = function(message)
  table.insert(notices, message)
end

-- A float the plugin didn't open, as a picker would be.
local user_float = nil

local function open_user_float()
  local buf = vim.api.nvim_create_buf(false, true)
  user_float = vim.api.nvim_open_win(buf, true, { relative = "editor", row = 1, col = 1, width = 10, height = 2 })
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

-- Each line's text, without the spaces that pad it across the window.
local function texts(chunks_list)
  return vim.tbl_map(function(chunks)
    local line = table.concat(vim.tbl_map(function(chunk)
      return chunk[1]
    end, chunks))
    return (line:gsub("%s+$", ""))
  end, chunks_list)
end

local function screen()
  local win = editor_window()
  local buf = vim.api.nvim_win_get_buf(win)
  local current = vim.api.nvim_get_current_win()
  local floating = vim.api.nvim_win_get_config(current).relative ~= ""
  local seen = { virt_lines = {}, values = {}, signs = {}, calls = {} }
  for _, mark in ipairs(marks(buf, state.ns)) do
    local line, details = mark[2] + 1, mark[4]
    if details.virt_lines then
      vim.list_extend(seen.virt_lines, texts(details.virt_lines))
    end
    if details.virt_text then
      table.insert(seen.calls, { line = line, text = texts({ details.virt_text })[1] })
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
    -- as the reader sees it, without its highlight codes
    first_line = vim.api.nvim_buf_get_lines(buf, 0, 1, false)[1],
    modified = vim.bo[buf].modified,
    winbar = (vim.wo[win].winbar:gsub("%%#[^#]*#", ""):gsub("%%%*", "")),
    float = floating and vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(current), 0, -1, false) or vim.NIL,
    virt_lines = seen.virt_lines,
    values = seen.values,
    signs = seen.signs,
    calls = seen.calls,
    user_float = user_float ~= nil and vim.api.nvim_win_is_valid(user_float),
    floats = #vim.tbl_filter(function(w)
      return vim.api.nvim_win_get_config(w).relative ~= ""
    end, vim.api.nvim_list_wins()),
    notices = vim.list_slice(notices),
  }
end

local function run(action)
  local view, notified = state.view, #notices
  local tour = action:match("^start:(.+)$")
  local line = action:match("^cursor:(%d+)$")
  local own_winbar = action:match("^winbar:(.+)$")
  local own_file = action:match("^edit:(.+)$")
  local typed = action:match("^type:(.+)$")
  if line then
    vim.api.nvim_win_set_cursor(0, { tonumber(line), 0 })
    -- headless Neovim fires this only for moves made by keys
    vim.api.nvim_exec_autocmds("CursorMoved", {})
    return
  elseif own_winbar then
    vim.wo.winbar = own_winbar
    return
  elseif typed then
    vim.api.nvim_buf_set_lines(0, 0, 1, false, { typed })
    return
  elseif action == "nohidden" then
    vim.o.hidden = false
    return
  elseif own_file then
    vim.cmd.edit(own_file)
    return
  elseif action == "userfloat" then
    open_user_float()
    return
  elseif tour then
    codetrail.start(tour)
  else
    codetrail[action]()
  end
  -- these answer at once, without the server
  local local_only = { quit = true, details = true, values = true, current = true }
  if not local_only[action] then
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
