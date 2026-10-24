-- codetrail for Neovim: step through a tour with the editor following.
--   :Trail path/to/tour.json
-- Default keys while a trail is open (configurable, see DEFAULT_KEYS below):
--   ]t / [t next / previous step     <leader>ti step into   <leader>to step out
--   <leader>tt details (overview before step 1)               <leader>tq quit
--   <leader>ta ask about the current step (enter on a cited repo/file:line jumps there)
-- Every action is also a command (:TrailNext, :TrailPrev, :TrailInto, :TrailOut,
-- :TrailDetails, :TrailAsk, :TrailQuit) and a function on this module.
-- Asking runs $CODETRAIL_AGENT with sh -c (no shell rc, so no aliases), else the first of
-- claude, codex, opencode on PATH. Each step fires `User CodetrailStep` with
-- { path, line, repo } for file explorers or user config to follow.
local ask = require("codetrail.ask")
local details = require("codetrail.details")
local navigation = require("codetrail.navigation")
local state = require("codetrail.state")
local step_view = require("codetrail.step_view")
local tour_file = require("codetrail.tour_file")

local M = {}

-- Linked to theme groups, so the colours follow the user's colour scheme.
for name, link in pairs({
  CodetrailStep = "CursorLine",
  CodetrailSummary = "DiagnosticInfo",
  CodetrailWarn = "DiagnosticWarn",
  CodetrailMuted = "Comment",
  CodetrailAdded = "Added",
  CodetrailChanged = "Changed",
  CodetrailCitation = "Underlined",
}) do
  vim.api.nvim_set_hl(0, name, { link = link, default = true })
end

local actions = require("codetrail.actions")

-- Keys are active only while a trail is open. Set them with require("codetrail").setup({ keys
-- = { next = "]w" } }) or vim.g.codetrail = { keys = … } (read when a trail starts, so it
-- works whatever the load order); `false` turns one key, or all of them, off. Commands and
-- the functions on this module work regardless.
local DEFAULT_KEYS = {
  next = "]t",
  previous = "[t",
  into = "<leader>ti",
  out = "<leader>to",
  details = "<leader>tt",
  ask = "<leader>ta",
  quit = "<leader>tq",
}

local setup_opts = {}

function M.setup(opts)
  setup_opts = opts or {}
end

local function configured_keys()
  local settings = vim.tbl_deep_extend("force", { keys = DEFAULT_KEYS }, vim.g.codetrail or {}, setup_opts)
  return settings.keys or {}
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
  if not state.tour then
    return
  end
  step_view.clear()
  vim.wo.winbar = ""
  unbind_keys(active_keys)
  active_keys = {}
  state.tour = nil
end

-- The actions, callable from keys, commands, or the user's own mappings at any time.
local function when_open(fn)
  return function()
    if not state.tour then
      vim.notify("codetrail: no trail is open; start one with :Trail <tour.json>", vim.log.levels.WARN)
      return
    end
    fn()
  end
end

M.next = when_open(navigation.next)
M.previous = when_open(navigation.previous)
M.into = when_open(navigation.into)
M.out = when_open(navigation.out)
M.details = when_open(details.show)
M.ask = when_open(ask.ask)

-- Lines the change touches come from <tour>.changed.json beside the tour, when present:
-- { [repo] = { [file] = { [line] = "added" | "changed" } } }.
function M.start(path)
  local tour = tour_file.read_json(path)
  local roots, missing = tour_file.repo_roots(tour)
  if not roots then
    vim.notify("codetrail: repo " .. missing.name .. " not found at " .. missing.source, vim.log.levels.ERROR)
    return
  end
  local changed_path = path:gsub("%.json$", ".changed.json")
  state.tour, state.roots = tour, roots
  state.changed = vim.fn.filereadable(changed_path) == 1 and tour_file.read_json(changed_path) or {}
  state.index, state.stack, state.by_id, state.notes = 0, {}, {}, {}
  for i, s in ipairs(tour.steps) do
    state.by_id[s.id] = i
  end
  if next(active_keys) ~= nil then
    unbind_keys(active_keys)
  end
  active_keys = configured_keys()
  bind_keys(active_keys)
  details.show()
end

return M
