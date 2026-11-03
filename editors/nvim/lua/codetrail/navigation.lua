-- Moving through the tour: each move asks the server, and its answer is drawn.
local details = require("codetrail.details")
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
  vim.wo.winbar = winbar.text(view)
  announce(view)
end

function M.show(view)
  if vim.api.nvim_win_get_config(0).relative ~= "" then
    vim.cmd("close")
  end
  state.view = view

  if view.kind == "step" then
    show_step(view)
  else
    step_view.clear()
    vim.wo.winbar = ""
    details.show()
  end
end

local function move(method, params)
  return function()
    server.request(method, params, M.show)
  end
end

M.next = move("next")
M.previous = move("prev")
M.into = move("into")
M.over = move("over")
M.out = move("out")

return M
