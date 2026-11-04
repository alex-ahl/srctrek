-- The overview, a step's details, and the end screen, from the server's view.
local actions = require("codetrail.actions")
local popup = require("codetrail.popup")
local server = require("codetrail.server")
local state = require("codetrail.state")
local text = require("codetrail.text")

local M = {}

local FLAGS = {
  high = { text = "⚠ likely wrong · ", wording = "likely wrong", group = "CodetrailFlagHigh" },
  medium = { text = "● risky · ", wording = "risky", group = "CodetrailFlagMedium" },
  low = { text = "● worth knowing · ", wording = "worth knowing", group = "CodetrailFlagLow" },
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
      doc.add("  ◇ " .. labelled(ref) .. ": " .. ref.summary, go_to(ref.id), "CodetrailContext")
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

local function flag_counts(flags)
  local counted = {}
  for _, severity in ipairs({ "high", "medium", "low" }) do
    if flags[severity] > 0 then
      table.insert(counted, flags[severity] .. " " .. FLAGS[severity].wording)
    end
  end
  return #counted > 0 and table.concat(counted, " · ") or "none"
end

-- The keys this tour has, as configured; turned-off ones aren't listed.
local function key_lines(doc)
  for _, action in ipairs(actions) do
    local key = state.keys[action.name]
    if key then
      doc.add(string.format("  %-12s %s", key, action.desc))
    end
  end
end

-- The story, where it starts and ends, its repos and flags, and the keys to step it with.
local function overview(view)
  local doc = new_doc()
  doc.extend(vim.split(view.overview, "\n"))
  doc.add("")
  doc.add("Trigger   " .. view.trigger.kind .. " · " .. view.trigger.input)
  doc.add("Outcome   " .. view.outcome)
  doc.add("Repos     " .. table.concat(view.repos, ", "))
  doc.add("Flags     " .. flag_counts(view.flags))
  doc.add("")
  doc.add("Keys", nil, "CodetrailHeading")
  key_lines(doc)
  doc.add("")
  local start = state.keys.next and (state.keys.next .. " to start") or ":TrailNext to start"
  doc.add(view.count .. " stops · " .. start, nil, "CodetrailUnchanged")
  popup.document(doc, view.title)
end

-- The outcome, then every flag in the tour, most severe first; enter on one goes to its step.
local function finish(view)
  local doc = new_doc()
  doc.add("End of tour", nil, "CodetrailHeading")
  doc.extend(vim.split(view.outcome, "\n"))
  doc.add("")
  if #view.flags == 0 then
    doc.add("No flags.", nil, "CodetrailUnchanged")
  else
    doc.add("Flags", nil, "CodetrailHeading")
  end
  for _, flag in ipairs(view.flags) do
    local style = FLAGS[flag.severity]
    doc.add(string.format("%s%d · %s", style.text, flag.number, labelled(flag)), go_to(flag.id), style.group)
    doc.add("    " .. flag.note, go_to(flag.id))
  end
  doc.add("")
  doc.add("enter on a flag goes to its step · [t last step · <leader>tq ends the tour", nil, "CodetrailUnchanged")
  popup.document(doc, view.title)
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
