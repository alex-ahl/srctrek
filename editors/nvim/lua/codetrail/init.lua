-- codetrail for Neovim: step through a tour with the editor following.
--   :Trail path/to/tour.json
--   ]t / [t next / previous step     <leader>ti step into   <leader>to step out
--   <leader>tt details (overview before step 1)               <leader>tq quit
--   <leader>ta ask about the current step (enter on a cited repo/file:line jumps there)
-- Every key is also a command (:TrailNext, :TrailPrev, :TrailInto, :TrailOut,
-- :TrailDetails, :TrailAsk, :TrailQuit) for rebinding when a key clashes.
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

local function quit()
  step_view.clear()
  vim.wo.winbar = ""
  for _, a in ipairs(M.actions) do
    pcall(vim.keymap.del, "n", a.key)
    for buf in pairs(state.bound) do
      if vim.api.nvim_buf_is_valid(buf) then
        pcall(vim.keymap.del, "n", a.key, { buffer = buf })
      end
    end
  end
  state.tour, state.bound = nil, {}
end

-- Each action as a key and as a command, so clashing keys can be rebound to the commands.
M.actions = {
  { key = "]t", command = "TrailNext", desc = "next step", fn = navigation.next },
  { key = "[t", command = "TrailPrev", desc = "previous step", fn = navigation.previous },
  { key = "<leader>ti", command = "TrailInto", desc = "step into", fn = navigation.into },
  { key = "<leader>to", command = "TrailOut", desc = "step out", fn = navigation.out },
  { key = "<leader>tt", command = "TrailDetails", desc = "details", fn = details.show },
  { key = "<leader>ta", command = "TrailAsk", desc = "ask about this step", fn = ask.ask },
  { key = "<leader>tq", command = "TrailQuit", desc = "quit", fn = quit },
}

local function bind_keys(buf)
  for _, a in ipairs(M.actions) do
    vim.keymap.set("n", a.key, a.fn, { buffer = buf, desc = "codetrail: " .. a.desc })
  end
  state.bound[buf] = true
end

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
  state.bind_keys = bind_keys
  for _, a in ipairs(M.actions) do
    vim.keymap.set("n", a.key, a.fn, { desc = "codetrail: " .. a.desc })
    vim.api.nvim_create_user_command(a.command, a.fn, { desc = "codetrail: " .. a.desc })
  end
  details.show()
end

return M
