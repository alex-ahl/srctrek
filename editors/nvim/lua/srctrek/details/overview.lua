-- The overview, before the first step.
local document = require("srctrek.details.doc")
local FLAGS = require("srctrek.flags")
local actions = require("srctrek.actions")
local popup = require("srctrek.popup")
local state = require("srctrek.state")

local M = {}

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
function M.show(view)
  local doc = document.new()
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

return M
