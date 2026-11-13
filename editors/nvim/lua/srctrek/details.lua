-- The overview, a step's details, and the end screen, from the server's view.
local actions = require("srctrek.actions")
local popup = require("srctrek.popup")
local server = require("srctrek.server")
local state = require("srctrek.state")
local text = require("srctrek.text")

local M = {}

local FLAGS = {
  high = { text = "⚠ likely wrong · ", wording = "likely wrong", group = "SrctrekFlagHigh" },
  medium = { text = "● risky · ", wording = "risky", group = "SrctrekFlagMedium" },
  low = { text = "● worth knowing · ", wording = "worth knowing", group = "SrctrekFlagLow" },
}

-- In full, as the code's line shows it shortened.
local function value_line(v)
  local subject = v.role == "return" and "returns" or v.name
  local wording = v.uncertain and "predicted, unsure" or "predicted"
  return string.format("  line %d: %s %s %s   %s", v.line, subject, v.uncertain and "≈?" or "≈", v.value, wording)
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
    server.request("goto", { step = id }, require("srctrek.navigation").show)
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

-- The cited line's own code, so the evidence reads without opening it.
local function code_at(path, line)
  local ok, lines = pcall(vim.fn.readfile, path, "", line)
  return ok and vim.trim(lines[line] or "") or ""
end

local function link_wording(view, link)
  if link.relation == "for" then
    return "Explains"
  end
  return view.step_kind == "hop" and "Reached by a hop from" or "Reached from"
end

-- Where the step came from, by stop and name, then each line its evidence cites with that line's
-- code under it; a link with no evidence of its own says it's guessed.
local function came_from_lines(view, doc)
  local link = view.came_from
  if link == vim.NIL then
    return
  end
  local name = link.name ~= vim.NIL and (" · " .. link.name) or ""
  local guessed = link.guessed and "   (guessed: matched by name)" or ""
  local heading = string.format("%s stop %d%s%s", link_wording(view, link), link.number, name, guessed)
  doc.add("")
  doc.add(heading, go_to(link.id), link.guessed and "SrctrekGuessed" or nil)

  for _, cite in ipairs(link.cites) do
    local open = open_at(cite.path, cite.line)
    doc.add(string.format("  %s: %s:%d", cite.repo, cite.file, cite.line), open, "SrctrekUnchanged")
    doc.add("    " .. code_at(cite.path, cite.line), open)
  end
end

local function step_lines(view)
  local doc = new_doc()
  doc.add(view.summary, nil, "SrctrekHeading")
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
    doc.add("Values", nil, "SrctrekHeading")
    for _, value in ipairs(view.predicted_values) do
      doc.add(value_line(value), nil, value.uncertain and "SrctrekDoubtful" or "SrctrekPredicted")
    end
  end
  if #view.context > 0 then
    doc.add("")
    doc.add("Context", nil, "SrctrekHeading")
    for _, ref in ipairs(view.context) do
      doc.add("  " .. labelled(ref) .. ": " .. ref.summary, go_to(ref.id), "SrctrekContext")
    end
  end
  local notes = view.notes
  if #notes > 0 then
    doc.add("")
    doc.add("Questions", nil, "SrctrekHeading")
    doc.extend(note_lines(notes))
  end
  doc.add("")
  doc.add("enter on where it came from, a line of evidence, or a context step goes there", nil, "SrctrekUnchanged")
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

-- The keys this trek has, as configured; turned-off ones aren't listed.
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
  doc.add("Keys", nil, "SrctrekHeading")
  key_lines(doc)
  local context = state.keys.context or ":TrekContext"
  doc.add("  \"context available\" in the winbar: " .. context .. " shows it", nil, "SrctrekContext")
  doc.add("")
  local start = state.keys.next and (state.keys.next .. " to start") or ":TrekNext to start"
  doc.add(view.count .. " stops · " .. start, nil, "SrctrekUnchanged")
  popup.document(doc, view.title)
end

-- The outcome, then every flag in the trek, most severe first; enter on one goes to its step.
local function finish(view)
  local doc = new_doc()
  doc.add("End of trek", nil, "SrctrekHeading")
  doc.extend(vim.split(view.outcome, "\n"))
  doc.add("")
  if #view.flags == 0 then
    doc.add("No flags.", nil, "SrctrekUnchanged")
  else
    doc.add("Flags", nil, "SrctrekHeading")
  end
  for _, flag in ipairs(view.flags) do
    local style = FLAGS[flag.severity]
    doc.add(string.format("%s%d · %s", style.text, flag.number, labelled(flag)), go_to(flag.id), style.group)
    doc.add("    " .. flag.note, go_to(flag.id))
  end
  doc.add("")
  local back = state.keys.previous or ":TrekPrev"
  local quit = state.keys.quit or ":TrekQuit"
  local hint = "enter on a flag goes to its step · " .. back .. " last step · " .. quit .. " ends the trek"
  doc.add(hint, nil, "SrctrekUnchanged")
  popup.document(doc, view.title)
end

-- Details for wherever the trek is: the overview, a step, or the end.
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
