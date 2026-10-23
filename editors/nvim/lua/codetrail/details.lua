-- The overview, a step's details, and the end screen.
local popup = require("codetrail.popup")
local state = require("codetrail.state")
local step_view = require("codetrail.step_view")

local M = {}

local function present(v)
  return v ~= nil and v ~= vim.NIL
end

local function overview(t)
  popup.markdown({
    "**Trigger** (" .. t.trigger.kind .. "): " .. t.trigger.input,
    "",
    "**Outcome:** " .. t.outcome,
    "",
    t.overview,
    "",
    "_" .. #t.steps .. " steps · ]t to start_",
  }, t.title)
end

local function step_lines(s, notes)
  local lines = { "**" .. s.summary .. "**", "", s.details }
  if present(s.via) then
    local cites = vim.tbl_map(function(c)
      return string.format("%s/%s:%d", c.repo, c.file, c.line)
    end, s.via.cites)
    vim.list_extend(lines, { "", "**Evidence:** " .. table.concat(cites, ", ") .. (s.via.guessed and "  _guessed_" or "") })
  end
  if present(s.predicted_values) then
    vim.list_extend(lines, { "", "**Predicted values**" })
    for k, v in pairs(s.predicted_values) do
      local value = tostring(v):gsub("%s*%(predicted%)$", "")
      table.insert(lines, "- `" .. k .. "` = `" .. value .. "` _(predicted)_")
    end
  end
  if present(s.uncertain) then
    vim.list_extend(lines, { "", "> ⚠ **" .. s.uncertain.severity .. ":** " .. s.uncertain.note })
  end
  if #notes > 0 then
    vim.list_extend(lines, { "", "---", "", "**Questions**" })
    for _, note in ipairs(notes) do
      vim.list_extend(lines, { "", "**Q:** " .. note.question, "" })
      vim.list_extend(lines, vim.split(note.answer, "\n"))
    end
  end
  return lines
end

local SEVERITY_ORDER = { high = 1, medium = 2, low = 3 }

local function flag_lines(steps)
  local flagged = vim.tbl_filter(function(s)
    return present(s.uncertain)
  end, steps)
  table.sort(flagged, function(a, b)
    return SEVERITY_ORDER[a.uncertain.severity] < SEVERITY_ORDER[b.uncertain.severity]
  end)
  return vim.tbl_map(function(s)
    return string.format("- ⚠ **%s** %s/%s:%d: %s", s.uncertain.severity, s.repo, s.file, s.start_line, s.uncertain.note)
  end, flagged)
end

local function question_lines()
  local lines = {}
  for i = 1, #state.tour.steps do
    for _, note in ipairs(state.notes[i] or {}) do
      vim.list_extend(lines, { "", "**" .. state.tour.steps[i].id .. " · Q:** " .. note.question, "" })
      vim.list_extend(lines, vim.split(note.answer, "\n"))
    end
  end
  return lines
end

local function restart()
  if vim.api.nvim_win_get_config(0).relative ~= "" then
    vim.cmd("close")
  end
  step_view.clear()
  vim.wo.winbar = ""
  state.index, state.stack = 0, {}
  M.show()
end

-- The end screen sits one position past the last step, so [t returns to that step.
function M.finish()
  local t = state.tour
  state.index = #t.steps + 1
  local lines = { "**End of trail.** " .. t.outcome }
  local flags = flag_lines(t.steps)
  if #flags > 0 then
    vim.list_extend(lines, { "", "**Flags**" })
    vim.list_extend(lines, flags)
  end
  local questions = question_lines()
  if #questions > 0 then
    vim.list_extend(lines, { "", "**Questions**" })
    vim.list_extend(lines, questions)
  end
  vim.list_extend(lines, { "", "_[t last step · gg restart · <leader>tq end tour · enter on a citation jumps_" })
  local buf = popup.markdown(lines, t.title)
  vim.keymap.set("n", "gg", restart, { buffer = buf })
end

-- Details for wherever the trail is: the overview, a step, or the end screen.
function M.show()
  local t = state.tour
  if state.index > #t.steps then
    M.finish()
  elseif state.index == 0 then
    overview(t)
  else
    local s = t.steps[state.index]
    local title = string.format("%s · %s · %s · %s", s.id, s.repo, s.kind, s.changed and "changed" or "unchanged")
    popup.markdown(step_lines(s, state.notes[state.index] or {}), title)
  end
end

return M
