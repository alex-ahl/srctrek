-- Moving through the tour: each move asks the server, and its answer is drawn.
local details = require("codetrail.details")
local popup = require("codetrail.popup")
local server = require("codetrail.server")
local state = require("codetrail.state")
local step_view = require("codetrail.step_view")
local winbar = require("codetrail.winbar")

local M = {}

-- Every step a view names carries its checkout's path, so the repos' roots come from them.
local function remember_roots(view)
  local refs = vim.list_extend({ view }, view.stack)
  vim.list_extend(refs, view.calls)
  vim.list_extend(refs, view.context)
  for _, ref in ipairs(refs) do
    state.roots[ref.repo] = ref.path:sub(1, #ref.path - #ref.file - 1)
  end
end

-- Each step fires `User CodetrailStep` with { path, line, repo }; anything may listen.
local function announce(view)
  vim.api.nvim_exec_autocmds("User", {
    pattern = "CodetrailStep",
    data = { path = view.path, line = view.start_line, repo = view.repo },
  })
end

local function show_step(view)
  remember_roots(view)
  step_view.show(view)
  winbar.show(vim.api.nvim_get_current_win(), view)
  announce(view)
end

function M.show(view)
  popup.close()
  state.view = view

  if view.kind == "step" then
    show_step(view)
  else
    step_view.clear()
    winbar.restore()
    details.show()
  end
end

local function move(method, params)
  return function()
    server.request(method, params, M.show)
  end
end

-- The call made on the cursor's line, when the cursor is in the step's file.
local function call_at_cursor(view)
  if view.kind ~= "step" or vim.api.nvim_buf_get_name(0) ~= view.path then
    return nil
  end
  local line = vim.api.nvim_win_get_cursor(0)[1]
  for _, call in ipairs(view.calls) do
    if call.call_line == line then
      return call
    end
  end
end

-- Back to the step the tour is on, without moving the tour.
function M.current()
  M.show(state.view)
end

M.next = move("next")
M.previous = move("prev")
M.over = move("over")
M.out = move("out")

-- Into the call on the cursor's line; elsewhere the server picks the first not yet visited.
function M.into()
  local call = call_at_cursor(state.view)
  server.request("into", call and { target = call.id } or nil, M.show)
end
return M
