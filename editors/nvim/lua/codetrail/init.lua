-- codetrail for Neovim: step through a tour with the editor following.
--   :Trail <tour>   a tour saved in Neovim's working directory, by name
-- Tours are loaded and stepped by `trail serve`, started in Neovim's working directory.
-- Default keys while a tour is open (configurable, see DEFAULT_KEYS below):
--   ]t / [t next / previous step   <leader>tn step over
--   <leader>ti step into           <leader>to step out
--   <leader>tt details (overview before step 1)               <leader>tq quit
--   <leader>ta ask about the current step (enter on a cited repo/file:line jumps there)
--   <leader>tv show or hide predicted values
-- Every action is also a command (:TrailNext, :TrailPrev, :TrailOver, :TrailInto, :TrailOut,
-- :TrailDetails, :TrailAsk, :TrailValues, :TrailQuit) and a function on this module.
-- Asking runs $CODETRAIL_AGENT with sh -c (no shell rc, so no aliases), the question as its
-- last argument. Each step fires `User CodetrailStep` with
-- { path, line, repo } for file explorers or user config to follow.
local ask = require("codetrail.ask")
local details = require("codetrail.details")
local inline_values = require("codetrail.inline_values")
local navigation = require("codetrail.navigation")
local server = require("codetrail.server")
local state = require("codetrail.state")
local step_view = require("codetrail.step_view")

local M = {}

-- Each role of the visual language, linked to a group the theme defines, so the colours follow
-- the user's colour scheme; set a role's group to override it.
for name, link in pairs({
  CodetrailStep = "CursorLine",
  CodetrailNarration = "Normal",
  CodetrailAdded = "DiffAdd",
  CodetrailChanged = "DiffChange",
  CodetrailUnchanged = "Comment",
  CodetrailPredicted = "LspInlayHint",
  CodetrailDoubtful = "DiagnosticWarn",
  CodetrailFlagHigh = "DiagnosticError",
  CodetrailStale = "DiagnosticWarn",
  CodetrailHop = "Comment",
  CodetrailContext = "Comment",
  CodetrailCitation = "Underlined",
}) do
  vim.api.nvim_set_hl(0, name, { link = link, default = true })
end

local actions = require("codetrail.actions")

-- Keys are active only while a tour is open. Set them with require("codetrail").setup({ keys
-- = { next = "]w" } }) or vim.g.codetrail = { keys = … } (read when a tour starts, so it
-- works whatever the load order); `false` turns one key, or all of them, off. Commands and
-- the functions on this module work regardless. `cmd` is how to start trail serve.
local DEFAULT_KEYS = {
  next = "]t",
  previous = "[t",
  over = "<leader>tn",
  into = "<leader>ti",
  out = "<leader>to",
  details = "<leader>tt",
  ask = "<leader>ta",
  values = "<leader>tv",
  quit = "<leader>tq",
}

local setup_opts = {}

function M.setup(opts)
  setup_opts = opts or {}
end

local function settings()
  local defaults = { keys = DEFAULT_KEYS, cmd = { "trail", "serve" } }
  return vim.tbl_deep_extend("force", defaults, vim.g.codetrail or {}, setup_opts)
end

-- Global mappings for the open trail. Whatever the user had on those keys is saved and put
-- back when the trail ends; buffer-local mappings, theirs or other plugins', are left alone.
local function bind_keys(keys)
  state.saved_maps = {}
  for _, a in ipairs(actions) do
    local lhs = keys[a.name]
    if lhs then
      local existing = vim.fn.maparg(lhs, "n", false, true)
      if next(existing) ~= nil and existing.buffer == 0 then
        table.insert(state.saved_maps, existing)
      end
      vim.keymap.set("n", lhs, M[a.name], { desc = "codetrail: " .. a.desc })
    end
  end
end

local function unbind_keys(keys)
  for _, a in ipairs(actions) do
    local lhs = keys[a.name]
    if lhs then
      pcall(vim.keymap.del, "n", lhs)
    end
  end
  for _, map in ipairs(state.saved_maps) do
    vim.fn.mapset("n", false, map)
  end
  state.saved_maps = {}
end

local active_keys = {}

function M.quit()
  if not state.view then
    return
  end
  step_view.clear()
  vim.wo.winbar = ""
  unbind_keys(active_keys)
  active_keys = {}
  state.view, state.overview = nil, nil
  server.stop()
end

-- The actions, callable from keys, commands, or the user's own mappings at any time.
local function when_open(fn)
  return function()
    if not state.view then
      vim.notify("codetrail: no tour is open; start one with :Trail <tour>", vim.log.levels.WARN)
      return
    end
    fn()
  end
end

M.next = when_open(navigation.next)
M.previous = when_open(navigation.previous)
M.over = when_open(navigation.over)
M.into = when_open(navigation.into)
M.out = when_open(navigation.out)
M.details = when_open(details.show)
M.ask = when_open(ask.ask)
M.values = when_open(inline_values.toggle)

local function opened(overview)
  if next(active_keys) ~= nil then
    unbind_keys(active_keys)
  end
  step_view.clear()
  state.overview, state.roots, state.notes = overview, {}, {}
  active_keys = settings().keys or {}
  bind_keys(active_keys)
  navigation.show(overview)
end

function M.start(name)
  server.start(settings().cmd, function()
    server.request("open", { tour = name }, opened)
  end)
end

return M
