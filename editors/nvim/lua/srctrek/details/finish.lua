-- The end screen.
local document = require("srctrek.details.doc")
local FLAGS = require("srctrek.flags")
local popup = require("srctrek.popup")
local state = require("srctrek.state")
local text = require("srctrek.text")

local M = {}

-- The outcome, then every flag in the trek, most severe first; enter on one goes to its step.
function M.show(view)
  local doc = document.new()
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
    doc.add(string.format("%s · %d · %s", style.label, flag.number, text.place_named(flag)), document.go_to(flag.id), style.group)
    doc.add("    " .. flag.note, document.go_to(flag.id))
  end
  doc.add("")
  local back = state.keys.previous or ":TrekPrev"
  local quit = state.keys.quit or ":TrekQuit"
  local hint = "enter on a flag goes to its step · " .. back .. " last step · " .. quit .. " ends the trek"
  doc.add(hint, nil, "SrctrekUnchanged")
  popup.document(doc, view.title)
end

return M
