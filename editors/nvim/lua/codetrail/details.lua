-- The overview, a step's details, and the end screen, from the server's view.
local popup = require("codetrail.popup")
local state = require("codetrail.state")

local M = {}

local function overview(view)
  popup.markdown({
    "**Trigger** (" .. view.trigger.kind .. "): " .. view.trigger.input,
    "",
    "**Outcome:** " .. view.outcome,
    "",
    view.overview,
    "",
    "_" .. view.count .. " stops · ]t to start_",
  }, view.title)
end

local FLAGS = {
  high = "⚠ **likely wrong:** ",
  medium = "● **risky:** ",
  low = "● **worth knowing:** ",
}

local function value_line(v)
  local described = v.role == "return" and ("returns `" .. v.value .. "`") or ("`" .. v.name .. "` = `" .. v.value .. "`")
  local wording = v.uncertain and "_predicted, unsure_" or "_predicted_"
  return string.format("- line %d: ≈ %s %s", v.line, described, wording)
end

local function note_lines(notes)
  local lines = {}
  for _, note in ipairs(notes) do
    vim.list_extend(lines, { "", "**Q:** " .. note.question, "" })
    vim.list_extend(lines, vim.split(note.answer, "\n"))
  end
  return lines
end

local function step_lines(view)
  local lines = { "**" .. view.summary .. "**", "", view.details }
  if view.flag ~= vim.NIL then
    vim.list_extend(lines, { "", FLAGS[view.flag.severity] .. view.flag.note })
  end
  if #view.predicted_values > 0 then
    vim.list_extend(lines, { "", "**Values**" })
    vim.list_extend(lines, vim.tbl_map(value_line, view.predicted_values))
  end
  if #view.context > 0 then
    vim.list_extend(lines, { "", "**Context**" })
    for _, ref in ipairs(view.context) do
      table.insert(lines, string.format("- %s/%s:%d: %s", ref.repo, ref.file, ref.start_line, ref.summary))
    end
  end
  local notes = vim.list_extend(vim.list_slice(view.notes), state.notes[view.id] or {})
  if #notes > 0 then
    vim.list_extend(lines, { "", "---", "", "**Questions**" })
    vim.list_extend(lines, note_lines(notes))
  end
  return lines
end

local function step_title(view)
  local parts = {
    string.format("%d / %d", view.number, view.count),
    view.repo,
    view.step_kind,
    view.changed and "changed" or "unchanged",
  }
  if view.stale then
    table.insert(parts, "stale: file changed since")
  end
  return table.concat(parts, " · ")
end

local function finish(view)
  popup.markdown({
    "**End of tour.** " .. view.outcome,
    "",
    "_[t last step · <leader>tq end tour_",
  }, view.title)
end

-- Details for wherever the tour is: the overview, a step, or the end.
function M.show()
  local view = state.view
  if view.kind == "overview" then
    overview(view)
  elseif view.kind == "end" then
    finish(view)
  else
    popup.markdown(step_lines(view), step_title(view))
  end
end

return M
