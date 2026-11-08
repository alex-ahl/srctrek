-- srctrek for Neovim: step through a tour with the editor following.
--   :Trek <tour>   a tour saved in Neovim's working directory, by name
-- Tours are loaded and stepped by `trek serve`, started in Neovim's working directory.
-- Default keys while a tour is open (configurable, see DEFAULT_KEYS below):
--   ]t / [t next / previous step   <leader>tn step over   <leader>tc back to the current step
--   <leader>ti step into           <leader>to step out    <leader>tx context code
--   <leader>tt details (overview before step 1)               <leader>tq quit
--   <leader>tv show or hide predicted values
-- Every action is also a command (:TrekNext, :TrekPrev, :TrekOver, :TrekInto, :TrekOut,
-- :TrekCurrent, :TrekContext, :TrekDetails, :TrekValues, :TrekQuit) and a function on this
-- module. Each step fires `User SrctrekStep` with { path, shown, line, repo } for file
-- explorers or user config to follow: `path` is the file in the user's project, `shown` the
-- file opened (the tour's copy when the user's file differs).
local context_code = require("srctrek.context_code")
local details = require("srctrek.details")
local inline_values = require("srctrek.inline_values")
local navigation = require("srctrek.navigation")
local origin = require("srctrek.origin")
local popup = require("srctrek.popup")
local server = require("srctrek.server")
local state = require("srctrek.state")
local step_view = require("srctrek.step_view")
local winbar = require("srctrek.winbar")

local M = {}

require("srctrek.highlights").setup()

local actions = require("srctrek.actions")

-- Keys are active only while a tour is open. Set them with require("srctrek").setup({ keys
-- = { next = "]w" } }) or vim.g.srctrek = { keys = … } (read when a tour starts, so it
-- works whatever the load order); `false` turns one key, or all of them, off. Commands and
-- the functions on this module work regardless. `cmd` is how to start trek serve.
local DEFAULT_KEYS = {
  next = "]t",
  previous = "[t",
  over = "<leader>tn",
  current = "<leader>tc",
  context = "<leader>tx",
  into = "<leader>ti",
  out = "<leader>to",
  details = "<leader>tt",
  values = "<leader>tv",
  quit = "<leader>tq",
}

local setup_opts = {}

function M.setup(opts)
  setup_opts = opts or {}
end

local function settings()
  local defaults = { keys = DEFAULT_KEYS, cmd = { "trek", "serve" } }
  return vim.tbl_deep_extend("force", defaults, vim.g.srctrek or {}, setup_opts)
end

-- Global mappings for the open trek. Whatever the user had on those keys is saved and put
-- back when the trek ends; buffer-local mappings, theirs or other plugins', are left alone.
local function bind_keys(keys)
  state.saved_maps = {}
  for _, a in ipairs(actions) do
    local lhs = keys[a.name]
    if lhs then
      local existing = vim.fn.maparg(lhs, "n", false, true)
      if next(existing) ~= nil and existing.buffer == 0 then
        table.insert(state.saved_maps, existing)
      end
      vim.keymap.set("n", lhs, M[a.name], { desc = "srctrek: " .. a.desc })
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
  popup.close()
  step_view.clear()
  step_view.restore_diagnostics()
  -- the window's own buffer first: window options like the winbar follow the buffer shown
  origin.restore()
  winbar.restore()
  unbind_keys(active_keys)
  active_keys = {}
  vim.api.nvim_create_augroup("srctrek_tour", { clear = true })
  state.view = nil
  server.stop()
end

local function say(message)
  vim.api.nvim_echo({ { "srctrek: " .. message } }, false, {})
end

-- The actions, callable from keys, commands, or the user's own mappings at any time.
local function when_open(fn)
  return function()
    if state.view then
      fn()
    elseif state.opening then
      say("still opening " .. state.opening .. "…")
    else
      vim.notify("srctrek: no tour is open; start one with :Trek <tour>", vim.log.levels.WARN)
    end
  end
end

M.next = when_open(navigation.next)
M.previous = when_open(navigation.previous)
M.over = when_open(navigation.over)
M.into = when_open(navigation.into)
M.out = when_open(navigation.out)
M.current = when_open(navigation.current)
M.details = when_open(details.show)
M.context = when_open(context_code.show)
M.values = when_open(inline_values.toggle)

local function watch_cursor()
  vim.api.nvim_create_autocmd({ "CursorMoved", "BufWinEnter" }, {
    group = vim.api.nvim_create_augroup("srctrek_tour", { clear = true }),
    callback = winbar.follow_cursor,
  })
end

local function bind_tour_keys()
  if next(active_keys) ~= nil then
    unbind_keys(active_keys)
  end
  active_keys = settings().keys or {}
  state.keys = active_keys
  bind_keys(active_keys)
end

local function opened(overview)
  -- the "opening…" message has done its job
  vim.api.nvim_echo({}, false, {})
  step_view.clear()
  state.opening = nil
  watch_cursor()
  navigation.show(overview)
end

-- A tour that didn't open leaves no keys behind, unless another tour is still open.
local function not_opened()
  state.opening = nil
  if not state.view then
    unbind_keys(active_keys)
    active_keys = {}
  end
end

-- The tour's keys are bound at once, so keys pressed while it opens reach srctrek rather than
-- Neovim's own commands.
function M.start(name)
  state.opening = name
  bind_tour_keys()
  say("opening " .. name .. "…")
  server.start(settings().cmd, function()
    server.request("open", { tour = name }, opened, not_opened)
  end, not_opened)
end

return M
