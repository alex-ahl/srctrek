local M = {}

function M.read_json(path)
  return vim.fn.json_decode(table.concat(vim.fn.readfile(path), "\n"))
end

-- A repo's source is a local directory, absolute or relative to Neovim's working directory.
-- Returns nil and the first repo whose source isn't one.
function M.repo_roots(tour)
  local roots = {}
  for _, r in ipairs(tour.repos) do
    local dir = vim.fn.fnamemodify(r.source, ":p"):gsub("/$", "")
    if vim.fn.isdirectory(dir) == 0 then
      return nil, r
    end
    roots[r.name] = dir
  end
  return roots
end

return M
