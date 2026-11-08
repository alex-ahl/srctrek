-- Predicted values at the end of the lines they belong to, like a debugger's inline values:
-- `name ≈ value`, as nothing runs, and `name ≈? value` in the warning colour when the trek doubts
-- it. Long values are cut so the line stays readable; details show them whole.
local state = require("srctrek.state")

local M = {}

-- What's on screen, so a toggle can redraw the values without moving the view.
local current = nil

local MAX_VALUE = 40

local function shortened(text)
  if vim.fn.strchars(text) <= MAX_VALUE then
    return text
  end
  return vim.fn.strcharpart(text, 0, MAX_VALUE - 1) .. "…"
end

local function describe(value)
  local sign = value.uncertain and "≈?" or "≈"
  local subject = value.role == "return" and "returns" or value.name
  return string.format("%s %s %s", subject, sign, shortened(value.value))
end

-- Each line's values, in the order the trek lists them, each in its own colour.
local function by_line(values)
  local lines = {}
  for _, value in ipairs(values) do
    lines[value.line] = lines[value.line] or {}
    table.insert(lines[value.line], value)
  end
  return lines
end

local function chunks_of(values)
  local chunks = { { "  ", "SrctrekPredicted" } }
  for i, value in ipairs(values) do
    if i > 1 then
      table.insert(chunks, { ", ", "SrctrekPredicted" })
    end
    table.insert(chunks, { describe(value), value.uncertain and "SrctrekDoubtful" or "SrctrekPredicted" })
  end
  return chunks
end

local function draw(buf, values, last)
  for line, on_line in pairs(by_line(values)) do
    if line <= last then
      vim.api.nvim_buf_set_extmark(buf, state.values_ns, line - 1, 0, {
        virt_text = chunks_of(on_line),
        virt_text_pos = "eol",
        -- blended with the step's tint; on their own they'd sit in a block of the plain background
        hl_mode = "combine",
        priority = state.EOL_PRIORITY,
      })
    end
  end
end

function M.show(buf, values, last)
  current = { buf = buf, values = values, last = last }
  if state.show_values then
    draw(buf, values, last)
  end
end

function M.toggle()
  state.show_values = not state.show_values
  if current == nil or not vim.api.nvim_buf_is_valid(current.buf) then
    return
  end

  vim.api.nvim_buf_clear_namespace(current.buf, state.values_ns, 0, -1)
  if state.show_values then
    draw(current.buf, current.values, current.last)
  end
end

return M
