-- Moving through the trail: next, previous, into, out.
local details = require("codetrail.details")
local state = require("codetrail.state")
local step_view = require("codetrail.step_view")

local M = {}

local function step_at(i)
  local s = vim.deepcopy(state.tour.steps[i])
  s.path = state.roots[s.repo] .. "/" .. s.file
  s.changes = state.changed
  return s
end

local function winbar()
  local s = state.tour.steps[state.index]
  local ids = {}
  for _, i in ipairs(state.stack) do
    table.insert(ids, state.tour.steps[i].id)
  end
  table.insert(ids, s.id)
  vim.wo.winbar = string.format(
    " codetrail  %d/%d  ·  %s/%s:%d  ·  %s  ·  %s",
    state.index,
    #state.tour.steps,
    s.repo,
    s.file,
    s.start_line,
    s.kind,
    table.concat(ids, " › ")
  )
end

-- Each step fires `User CodetrailStep` with { path, line, repo }; anything may listen.
local function announce(step)
  vim.api.nvim_exec_autocmds("User", {
    pattern = "CodetrailStep",
    data = { path = step.path, line = step.start_line, repo = step.repo },
  })
end

local function go(i)
  if not state.tour or i < 1 or i > #state.tour.steps then
    return
  end
  if vim.api.nvim_win_get_config(0).relative ~= "" then
    vim.cmd("close")
  end
  state.index = i
  local step = step_at(i)
  step_view.show(step)
  winbar()
  announce(step)
end

function M.next()
  if state.tour and state.index == #state.tour.steps then
    details.finish()
  else
    go(state.index + 1)
  end
end

function M.previous()
  go(state.index - 1)
end

function M.into()
  local s = state.tour and state.tour.steps[state.index]
  local target = s and s.calls and state.by_id[s.calls]
  if target then
    table.insert(state.stack, state.index)
    go(target)
  end
end

function M.out()
  local caller = table.remove(state.stack)
  if caller then
    go(caller)
  end
end

return M
