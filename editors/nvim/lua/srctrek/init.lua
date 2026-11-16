-- srctrek for Neovim: step through a trek with the editor following. Keys, commands, and events
-- are in the plugin's README.
local context_code = require("srctrek.context_code")
local details = require("srctrek.details")
local inline_values = require("srctrek.inline_values")
local navigation = require("srctrek.navigation")
local origin = require("srctrek.origin")
local popup = require("srctrek.popup")
local server = require("srctrek.server")
local state = require("srctrek.state")
local step = require("srctrek.step")
local winbar = require("srctrek.winbar")

local M = {}

require("srctrek.highlights").setup()

local actions = require("srctrek.actions")

-- Keys are active only while a trek is open. Set them with require("srctrek").setup({ keys
-- = { next = "]w" } }) or vim.g.srctrek = { keys = … } (read when a trek starts, so it
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

function M.quit()
  if not state.view then
    return
  end
  popup.close()
  step.clear()
  step.restore_diagnostics()
  -- the window's own buffer first: window options like the winbar follow the buffer shown
  origin.restore()
  winbar.restore()
  unbind_keys(state.keys)
  state.keys = {}
  vim.api.nvim_create_augroup("srctrek_trek", { clear = true })
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
      vim.notify("srctrek: no trek is open; start one with :Trek <trek>", vim.log.levels.WARN)
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
    group = vim.api.nvim_create_augroup("srctrek_trek", { clear = true }),
    callback = winbar.follow_cursor,
  })
end

local function bind_trek_keys()
  if next(state.keys) ~= nil then
    unbind_keys(state.keys)
  end
  state.keys = settings().keys or {}
  bind_keys(state.keys)
end

local function opened(overview)
  -- the "opening…" message has done its job
  vim.api.nvim_echo({}, false, {})
  step.clear()
  state.opening = nil
  watch_cursor()
  navigation.show(overview)
end

-- A trek that didn't open leaves no keys behind, unless another trek is still open.
local function not_opened()
  state.opening = nil
  if not state.view then
    unbind_keys(state.keys)
    state.keys = {}
  end
end

-- The trek's keys are bound at once, so keys pressed while it opens reach srctrek rather than
-- Neovim's own commands.
function M.start(name)
  state.opening = name
  bind_trek_keys()
  say("opening " .. name .. "…")
  server.start(settings().cmd, function()
    server.request("open", { trek = name }, opened, not_opened)
  end, not_opened)
end

return M
