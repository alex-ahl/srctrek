-- Captures what the Neovim plugin draws, as a person would see it, without a terminal: runs
-- `nvim --embed` with this checkout's plugin, attaches to it as its UI over pipes, sends key
-- groups, and after each writes the screen as text with its colours (.txt) and as a picture
-- (.png, drawn with ImageMagick in Menlo).
--
--   nvim --headless -l scripts/nvim-screen.lua <out-prefix> <setup> <trek> [keys]...
--
-- Run from the repo root after `bun run build`. <setup> is an Ex command run before the plugin
-- loads, such as "set background=light | colorscheme retrobox". Each [keys] is sent as typed.
local W, H = 110, 32
local CELL_WIDTH, CELL_HEIGHT = 8.43, 17
local FONT = "/System/Library/Fonts/Menlo.ttc"

local out, setup, trek = arg[1], arg[2], arg[3]
local key_groups = vim.list_slice(arg, 4)
local repo = vim.fn.getcwd()

-- The screen as Neovim's UI events describe it: each cell's text and highlight id.
local screen = { cells = {}, attrs = { [0] = {} }, fg = 0xffffff, bg = 0 }

local function clear_cells()
  for row = 0, H - 1 do
    screen.cells[row] = {}
    for col = 0, W - 1 do
      screen.cells[row][col] = { " ", 0 }
    end
  end
end

local function put_line(_, row, col, cells)
  local hl = 0
  for _, cell in ipairs(cells) do
    hl = cell[2] or hl
    for _ = 1, cell[3] or 1 do
      if screen.cells[row] and screen.cells[row][col] then
        screen.cells[row][col] = { cell[1], hl }
      end
      col = col + 1
    end
  end
end

local function scroll(_, top, bottom, left, right, rows)
  local before = vim.deepcopy(screen.cells)
  for row = top, bottom - 1 do
    local from = row + rows
    if from >= top and from < bottom then
      for col = left, right - 1 do
        screen.cells[row][col] = before[from][col]
      end
    end
  end
end

local EVENTS = {
  default_colors_set = function(fg, bg)
    screen.fg, screen.bg = fg, bg
  end,
  hl_attr_define = function(id, rgb)
    screen.attrs[id] = rgb
  end,
  grid_resize = clear_cells,
  grid_clear = clear_cells,
  grid_line = put_line,
  grid_scroll = scroll,
}

local function on_redraw(batches)
  for _, batch in ipairs(batches) do
    local handle = EVENTS[batch[1]]
    for i = 2, #batch do
      if handle then
        handle(unpack(batch[i]))
      end
    end
  end
end

local function hex(colour)
  return colour and string.format("#%06x", colour) or ""
end

local function colours_of(cell)
  local attr = screen.attrs[cell[2]] or {}
  local fg, bg = attr.foreground or screen.fg, attr.background or screen.bg
  if attr.reverse then
    return bg, fg, attr
  end
  return fg, bg, attr
end

-- The text, then each row's runs of one style that aren't the editor's own: col-col fg/bg.
local function as_text()
  local lines, styles = { "editor fg/bg " .. hex(screen.fg) .. "/" .. hex(screen.bg) }, { "", "styles:" }
  for row = 0, H - 1 do
    local text, runs = {}, {}
    for col = 0, W - 1 do
      local cell = screen.cells[row][col]
      local attr = screen.attrs[cell[2]] or {}
      local style = hex(attr.foreground) .. "/" .. hex(attr.background) .. (attr.italic and " italic" or "")
      local last = runs[#runs]
      if last and last.style == style then
        last.to = col
      else
        table.insert(runs, { from = col, to = col, style = style })
      end
      table.insert(text, cell[1])
    end
    table.insert(lines, string.format("%2d|%s", row, table.concat(text)))
    local styled = vim.tbl_filter(function(run)
      return run.style ~= "/"
    end, runs)
    if #styled > 0 then
      local described = vim.tbl_map(function(run)
        return run.from .. "-" .. run.to .. " " .. run.style
      end, styled)
      table.insert(styles, string.format("%2d: %s", row, table.concat(described, "  ")))
    end
  end
  return vim.list_extend(lines, styles)
end

local function mvg_string(text)
  return "'" .. text:gsub("\\", "\\\\"):gsub("'", "\\'") .. "'"
end

-- ImageMagick drawing commands: each cell's background where it isn't the editor's, then its
-- character.
local function as_drawing()
  local ops = { "font '" .. FONT .. "'", "font-size 14" }
  for row = 0, H - 1 do
    for col = 0, W - 1 do
      local cell = screen.cells[row][col]
      local fg, bg = colours_of(cell)
      local x, y = col * CELL_WIDTH, row * CELL_HEIGHT
      if bg ~= screen.bg then
        table.insert(ops, string.format("fill '%s' rectangle %.1f,%d %.1f,%d", hex(bg), x, y, x + CELL_WIDTH, y + CELL_HEIGHT - 1))
      end
      if cell[1] ~= " " and cell[1] ~= "" then
        table.insert(ops, string.format("fill '%s' text %.1f,%d %s", hex(fg), x, y + CELL_HEIGHT - 4, mvg_string(cell[1])))
      end
    end
  end
  return ops
end

local function save(n)
  local prefix = out .. "-" .. n
  vim.fn.writefile(as_text(), prefix .. ".txt")
  vim.fn.writefile(as_drawing(), prefix .. ".mvg")
  local size = math.ceil(W * CELL_WIDTH) .. "x" .. H * CELL_HEIGHT
  vim.fn.system({ "magick", "-size", size, "xc:" .. hex(screen.bg), "-draw", "@" .. prefix .. ".mvg", prefix .. ".png" })
  vim.fn.delete(prefix .. ".mvg")
end

-- Neovim to capture, with the plugin talking to this checkout's trek.
local function start_neovim()
  local stdin, stdout = vim.uv.new_pipe(), vim.uv.new_pipe()
  local serve = string.format('lua vim.g.srctrek = { cmd = { "%s/dist/trek", "serve" } }', repo)
  vim.uv.spawn("nvim", {
    args = {
      "--embed", "--clean", "--cmd", "set rtp^=" .. repo .. "/editors/nvim",
      "-c", "set termguicolors", "-c", setup, "-c", "runtime! plugin/srctrek.lua", "-c", serve,
    },
    stdio = { stdin, stdout, nil },
    cwd = repo,
  }, function() end)

  -- window, buffer, and tabpage handles arrive as msgpack extensions; their bytes will do
  local keep_bytes = function(_, bytes)
    return bytes
  end
  local decode = vim.mpack.Unpacker({ ext = { [0] = keep_bytes, [1] = keep_bytes, [2] = keep_bytes } })
  stdout:read_start(function(_, data)
    local pos = 1
    while data and pos <= #data do
      local message
      message, pos = decode(data, pos)
      if message and message[1] == 2 and message[2] == "redraw" then
        on_redraw(message[3])
      end
    end
  end)

  local id = 0
  return function(method, params)
    id = id + 1
    stdin:write(vim.mpack.encode({ 0, id, method, params }))
  end
end

clear_cells()
local request = start_neovim()
request("nvim_ui_attach", { W, H, { ext_linegrid = true, rgb = true } })
vim.wait(800)
request("nvim_command", { "Trek " .. trek })
vim.wait(1500)
save(0)
for n, keys in ipairs(key_groups) do
  request("nvim_input", { keys })
  vim.wait(1200)
  save(n)
end
request("nvim_command", { "qa!" })
vim.wait(300)
