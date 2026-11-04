-- The overview, a step's details, and the end screen, from the server's view.
local popup = require("codetrail.popup")
local server = require("codetrail.server")
local state = require("codetrail.state")
local text = require("codetrail.text")

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
  high = { text = "⚠ likely wrong: ", group = "CodetrailFlagHigh" },
  medium = { text = "● risky: ", group = "CodetrailFlagMedium" },
  low = { text = "● worth knowing: ", group = "CodetrailFlagLow" },
}

local function value_line(v)
  local described = v.role == "return" and ("returns " .. v.value) or (v.name .. " = " .. v.value)
  local wording = v.uncertain and "predicted, unsure" or "predicted"
  return string.format("  line %d: ≈ %s   %s", v.line, described, wording)
end

local function note_lines(notes)
  local lines = {}
  for _, note in ipairs(notes) do
    vim.list_extend(lines, { "", "Q: " .. note.question, "" })
    vim.list_extend(lines, vim.split(note.answer, "\n"))
  end
  return lines
end

-- Lines for a popup, with each one's colour and what enter does on it.
local function new_doc()
  local doc = { lines = {}, groups = {}, actions = {} }
  function doc.add(line, action, group)
    table.insert(doc.lines, line)
    doc.actions[#doc.lines] = action
    doc.groups[#doc.lines] = group
  end
  function doc.extend(lines)
    for _, line in ipairs(lines) do
      doc.add(line)
    end
  end
  return doc
end

-- navigation draws views and opens this module's popups, so it's required when first used
local function go_to(id)
  return function()
    server.request("goto", { step = id }, require("codetrail.navigation").show)
  end
end

local function open_at(path, line)
  return function()
    popup.close()
    vim.cmd("edit " .. vim.fn.fnameescape(path))
    vim.api.nvim_win_set_cursor(0, { line, 0 })
    vim.cmd("normal! zz")
  end
end

local function labelled(ref)
  local name = ref.name ~= vim.NIL and (" · " .. ref.name) or ""
  return text.place(ref) .. name
end

-- Where the step came from, cited (→) or guessed by name (⇢), and the lines its evidence cites.
local function came_from_lines(view, doc)
  local link = view.came_from
  if link == vim.NIL then
    return
  end
  local marker = link.guessed and "⇢" or "→"
  local wording = link.relation == "for" and "explains" or (view.step_kind == "hop" and "hop from" or "came from")
  local guessed = link.guessed and "   guessed: matched by name" or ""
  doc.add("")
  local line = string.format("%s %s %d · %s%s", marker, wording, link.number, labelled(link), guessed)
  doc.add(line, go_to(link.id), link.guessed and "CodetrailGuessed" or nil)
  for _, cite in ipairs(link.cites) do
    local evidence = string.format("  evidence: %s/%s:%d", cite.repo, cite.file, cite.line)
    doc.add(evidence, open_at(cite.path, cite.line), "CodetrailCitation")
  end
end

local function step_lines(view)
  local doc = new_doc()
  doc.add(view.summary, nil, "CodetrailHeading")
  doc.add("")
  doc.extend(vim.split(view.details, "\n"))
  came_from_lines(view, doc)
  if view.flag ~= vim.NIL then
    local flag = FLAGS[view.flag.severity]
    doc.add("")
    doc.add(flag.text .. view.flag.note, nil, flag.group)
  end
  if #view.predicted_values > 0 then
    doc.add("")
    doc.add("Values", nil, "CodetrailHeading")
    for _, value in ipairs(view.predicted_values) do
      doc.add(value_line(value), nil, value.uncertain and "CodetrailDoubtful" or "CodetrailPredicted")
    end
  end
  if #view.context > 0 then
    doc.add("")
    doc.add("Context", nil, "CodetrailHeading")
    for _, ref in ipairs(view.context) do
      doc.add("  " .. labelled(ref) .. ": " .. ref.summary, go_to(ref.id))
    end
  end
  local notes = vim.list_extend(vim.list_slice(view.notes), state.notes[view.id] or {})
  if #notes > 0 then
    doc.add("")
    doc.add("Questions", nil, "CodetrailHeading")
    doc.extend(note_lines(notes))
  end
  doc.add("")
  doc.add("enter on a → line, an evidence line, or a context step goes there", nil, "CodetrailUnchanged")
  return doc
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
    popup.document(step_lines(view), step_title(view))
  end
end

return M
