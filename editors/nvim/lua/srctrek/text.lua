local M = {}

function M.fit(text, width)
  if vim.fn.strdisplaywidth(text) <= width then
    return text
  end
  return vim.fn.strcharpart(text, 0, width - 1) .. "…"
end

-- Word-wraps `text` to `width` columns, at most `max` lines; continuation lines are indented
-- by `indent` so they line up under the text after the leading marker.
function M.wrap(text, width, max, indent)
  local lines, current = {}, ""
  for word in text:gmatch("%S+") do
    local candidate = current == "" and word or (current .. " " .. word)
    local limit = #lines == 0 and width or (width - #indent)
    if vim.fn.strdisplaywidth(candidate) > limit and current ~= "" then
      table.insert(lines, current)
      current = word
    else
      current = candidate
    end
  end
  table.insert(lines, current)
  if #lines > max then
    lines = vim.list_slice(lines, 1, max)
    lines[max] = M.fit(lines[max] .. " …", width - #indent)
  end
  for i = 2, #lines do
    lines[i] = indent .. lines[i]
  end
  return lines
end

-- A step's place, short: its file's last two path segments and its line, handlers/refunds.ts:8.
function M.place(ref)
  local short = ref.file:match("[^/]+/[^/]+$") or ref.file
  return short .. ":" .. ref.start_line
end

-- A step's name, or its place when it has none.
function M.name_or_place(ref)
  return ref.name ~= vim.NIL and ref.name or M.place(ref)
end

-- A step's place, then its name when it has one: handlers/refunds.ts:8 · refund.
function M.place_named(ref)
  local name = ref.name ~= vim.NIL and (" · " .. ref.name) or ""
  return M.place(ref) .. name
end

return M
