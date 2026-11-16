-- A step's details: what it does, where it came from and the evidence for it, its flag, values,
-- context, and questions.
local document = require("srctrek.details.doc")
local FLAGS = require("srctrek.flags")
local inline_values = require("srctrek.inline_values")
local popup = require("srctrek.popup")
local text = require("srctrek.text")

local M = {}

-- In full, as the code's line shows it shortened.
local function value_line(v)
  local wording = v.uncertain and "predicted, unsure" or "predicted"
  return string.format("  line %d: %s   %s", v.line, inline_values.describe(v, true), wording)
end

local function note_lines(notes)
  local lines = {}
  for _, note in ipairs(notes) do
    vim.list_extend(lines, { "", "Q: " .. note.question, "" })
    vim.list_extend(lines, vim.split(note.answer, "\n"))
  end
  return lines
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
  doc.add(heading, document.go_to(link.id), link.guessed and "SrctrekGuessed" or nil)

  for _, cite in ipairs(link.cites) do
    local open = document.open_at(cite.path, cite.line)
    doc.add(string.format("  %s: %s:%d", cite.repo, cite.file, cite.line), open, "SrctrekUnchanged")
    doc.add("    " .. code_at(cite.path, cite.line), open)
  end
end

local function step_lines(view)
  local doc = document.new()
  doc.add(view.summary, nil, "SrctrekHeading")
  doc.add("")
  doc.extend(vim.split(view.details, "\n"))
  came_from_lines(view, doc)
  if view.flag ~= vim.NIL then
    local flag = FLAGS[view.flag.severity]
    doc.add("")
    doc.add(flag.label .. " · " .. view.flag.note, nil, flag.group)
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
      doc.add("  " .. text.place_named(ref) .. ": " .. ref.summary, document.go_to(ref.id), "SrctrekContext")
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

function M.show(view)
  popup.document(step_lines(view), step_title(view))
end

return M
