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

-- Each step fires `User CodetrailStep` with { path, shown, line, repo }; anything may listen.
-- `path` is where the file lives in the user's project, for a file tree to reveal; `shown` is
-- the file opened, the tour's copy when the user's file differs.
local function announce(view)
  vim.api.nvim_exec_autocmds("User", {
    pattern = "CodetrailStep",
    data = {
      path = view.own_path ~= vim.NIL and view.own_path or view.path,
      shown = view.path,
      line = view.start_line,
      repo = view.repo,
    },
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

local NOWHERE = {
  next = "the tour ends here",
  prev = "this is the start of the tour",
  into = "nothing to step into here",
  over = "nothing to step over here",
  out = "nothing to step out to",
}

-- A move with nowhere to go answers with the view it had; redrawing that would snap the cursor
-- back to the step's first line, so it says so instead.
local function answer(method)
  return function(view)
    local before = state.view
    if before and before.kind == view.kind and before.id == view.id then
      vim.api.nvim_echo({ { "codetrail: " .. NOWHERE[method] } }, true, {})
      return
    end
    M.show(view)
  end
end

local function move(method, params)
  return function()
    server.request(method, params, answer(method))
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
  server.request("into", call and { target = call.id } or nil, answer("into"))
end
return M
