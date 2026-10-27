-- Predicted values at the end of the lines they belong to, like a debugger's inline values.
-- Always marked "≈ … predicted": codetrail runs nothing. Doubtful ones take the warning colour.
local state = require("codetrail.state")

local M = {}

-- The step on screen, so a toggle can redraw its values without moving the view.
local current = nil

local function describe(value)
  if value.role == "return" then
    return "returns " .. value.value
  end

  return value.name .. " = " .. value.value
end

-- Values grouped by line, in the order the tour lists them; a line with a doubtful value is
-- marked doubtful as a whole.
local function by_line(values)
  local lines = {}
  for _, value in ipairs(values) do
    lines[value.line] = lines[value.line] or { texts = {}, uncertain = false }
    table.insert(lines[value.line].texts, describe(value))
    lines[value.line].uncertain = lines[value.line].uncertain or value.uncertain == true
  end

  return lines
end

local function draw(buf, step, last)
  local values = step.predicted_values
  if values == nil or values == vim.NIL then
    return
  end

  for line, group in pairs(by_line(values)) do
    if line <= last then
      local colour = group.uncertain and "CodetrailWarn" or "CodetrailPredicted"
      vim.api.nvim_buf_set_extmark(buf, state.values_ns, line - 1, 0, {
        virt_text = {
          { "  ≈ " .. table.concat(group.texts, ", "), colour },
          { "  predicted", "CodetrailMuted" },
        },
        virt_text_pos = "eol",
      })
    end
  end
end

function M.show(buf, step, last)
  current = { buf = buf, step = step, last = last }
  if state.show_values then
    draw(buf, step, last)
  end
end

function M.toggle()
  state.show_values = not state.show_values
  if current == nil or not vim.api.nvim_buf_is_valid(current.buf) then
    return
  end

  vim.api.nvim_buf_clear_namespace(current.buf, state.values_ns, 0, -1)
  if state.show_values then
    draw(current.buf, current.step, current.last)
  end
end

return M
