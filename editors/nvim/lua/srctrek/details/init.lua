-- The overview, a step's details, and the end screen, from the server's view.
local finish = require("srctrek.details.finish")
local overview = require("srctrek.details.overview")
local state = require("srctrek.state")
local step = require("srctrek.details.step")

local M = {}

-- Details for wherever the trek is: the overview, a step, or the end.
function M.show()
  local view = state.view
  if view.kind == "overview" then
    overview.show(view)
  elseif view.kind == "end" then
    finish.show(view)
  else
    step.show(view)
  end
end

return M
