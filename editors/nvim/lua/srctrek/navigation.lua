-- Moving through the trek: each move asks the server, and its answer is drawn.
local details = require("srctrek.details")
local popup = require("srctrek.popup")
local server = require("srctrek.server")
local state = require("srctrek.state")
local step_view = require("srctrek.step_view")
local winbar = require("srctrek.winbar")

local M = {}

-- Each step fires `User SrctrekStep` with { path, shown, line, repo }; anything may listen.
-- `path` is where the file lives in the user's project, for a file tree to reveal; `shown` is
-- the file opened, the trek's copy when the user's file differs.
local function announce(view)
  vim.api.nvim_exec_autocmds("User", {
    pattern = "SrctrekStep",
    data = {
      path = view.own_path ~= vim.NIL and view.own_path or view.path,
      shown = view.path,
      line = view.start_line,
      repo = view.repo,
    },
  })
end

local function show_step(view)
  local drawn = step_view.show(view)
  winbar.show(vim.api.nvim_get_current_win(), view, drawn.new_file)
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
  next = "the trek ends here",
  prev = "this is the start of the trek",
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
      vim.api.nvim_echo({ { "srctrek: " .. NOWHERE[method] } }, true, {})
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

-- Back to the step the trek is on, without moving the trek.
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
