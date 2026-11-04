-- Each role of the visual language takes its colour from the theme, so the colours follow the
-- user's colour scheme; set a role's group to override it.
local M = {}

local LINKED = {
  CodetrailStale = "DiagnosticWarn",
  CodetrailHop = "Comment",
  CodetrailAway = "Comment",
  CodetrailCitation = "Underlined",
}

-- Text at the end of a line, in the gutter, or on the narration's band takes only its group's
-- foreground: themes often give these groups a background (inlay hints, diff lines), which
-- draws a box there.
local FOREGROUND = {
  CodetrailCurrent = { group = "DiagnosticWarn" },
  CodetrailAdded = { group = "Added" },
  CodetrailChanged = { group = "Changed" },
  CodetrailPredicted = { group = "LspInlayHint", italic = true },
  CodetrailDoubtful = { group = "DiagnosticWarn", italic = true },
  CodetrailCall = { group = "Special" },
  CodetrailUnchanged = { group = "Comment" },
  CodetrailFlagHigh = { group = "DiagnosticError" },
  CodetrailPosition = { group = "Normal", bold = true },
  CodetrailTourCopy = { group = "DiagnosticHint" },
  CodetrailFlagMedium = { group = "DiagnosticWarn" },
  CodetrailFlagLow = { group = "DiagnosticInfo" },
  CodetrailGuessed = { group = "DiagnosticHint" },
  CodetrailHeading = { group = "Normal", bold = true },
}

local function colour(group, attribute)
  return vim.api.nvim_get_hl(0, { name = group, link = false })[attribute]
end

-- `from` moved `amount` of the way towards `to`, channel by channel.
local function mix(from, to, amount)
  local mixed = 0
  for shift = 0, 16, 8 do
    local a, b = bit.band(bit.rshift(from, shift), 0xff), bit.band(bit.rshift(to, shift), 0xff)
    mixed = mixed + bit.lshift(math.floor(a + (b - a) * amount + 0.5), shift)
  end
  return mixed
end

local function luminance(c)
  local r, g, b = bit.band(bit.rshift(c, 16), 0xff), bit.band(bit.rshift(c, 8), 0xff), bit.band(c, 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
end

-- Of the theme's text and background colours, the one that reads best on `fill`.
local function readable_on(fill, a, b)
  local distance = function(c)
    return math.abs(luminance(c) - luminance(fill))
  end
  return distance(a) >= distance(b) and a or b
end

-- The band moved towards the info colour, and towards the text too when that alone leaves it
-- too close to the background to see, as a light info colour does on a light theme.
local function band_colour(bg, fg, accent)
  local towards_info = mix(bg, accent, 0.22)
  local band, towards_text = towards_info, 0
  while math.abs(luminance(band) - luminance(bg)) < 24 and towards_text < 0.5 do
    towards_text = towards_text + 0.04
    band = mix(towards_info, fg, towards_text)
  end
  return band
end

-- No single theme group is reliably distinct from the background in every theme (ColorColumn
-- is darker in some, CursorLine is the cursor's own), so the step's tint, the narration's band,
-- and the badge are mixed from the theme's text, background, and info colours. Without GUI
-- colours they fall back to theme groups.
-- The gutter's signs and line numbers on a step's lines: their own colours on the step's tint.
local IN_STEP = { "CodetrailStepBar", "CodetrailAdded", "CodetrailChanged", "CodetrailCurrent" }

local function define_in_step(tint)
  for _, group in ipairs(IN_STEP) do
    vim.api.nvim_set_hl(0, group .. "InStep", { fg = colour(group, "fg"), bg = tint, default = true })
  end
  vim.api.nvim_set_hl(0, "CodetrailStepNumber", { fg = colour("LineNr", "fg"), bg = tint, default = true })
end

local function define_mixed()
  local fg, accent = colour("Normal", "fg"), colour("DiagnosticInfo", "fg")
  -- a transparent theme leaves the background to the terminal
  local bg = colour("Normal", "bg") or (vim.o.background == "light" and 0xffffff or 0x000000)
  if not (vim.o.termguicolors and fg and accent) then
    vim.api.nvim_set_hl(0, "CodetrailStep", { link = "CursorLine", default = true })
    vim.api.nvim_set_hl(0, "CodetrailStepBar", { link = "LineNr", default = true })
    define_in_step(colour("CursorLine", "bg"))
    vim.api.nvim_set_hl(0, "CodetrailNarration", { link = "Pmenu", default = true })
    vim.api.nvim_set_hl(0, "CodetrailBandPad", { fg = colour("Pmenu", "bg"), default = true })
    vim.api.nvim_set_hl(0, "CodetrailBandPadStep", { fg = colour("Pmenu", "bg"), bg = colour("CursorLine", "bg"), default = true })
    vim.api.nvim_set_hl(0, "CodetrailBandEdge", { link = "Special", default = true })
    vim.api.nvim_set_hl(0, "CodetrailBandPadEdge", { link = "Special", default = true })
    vim.api.nvim_set_hl(0, "CodetrailBandPadEdgeStep", { link = "Special", default = true })
    vim.api.nvim_set_hl(0, "CodetrailContext", { link = "DiagnosticInfo", default = true })
    vim.api.nvim_set_hl(0, "CodetrailBadge", { link = "PmenuSel", default = true })
    return
  end

  local tint = mix(bg, fg, 0.08)
  vim.api.nvim_set_hl(0, "CodetrailStep", { bg = tint, default = true })
  vim.api.nvim_set_hl(0, "CodetrailStepBar", { fg = mix(bg, fg, 0.3), default = true })
  define_in_step(tint)
  local band = band_colour(bg, fg, accent)
  vim.api.nvim_set_hl(0, "CodetrailNarration", { fg = fg, bg = band, default = true })
  vim.api.nvim_set_hl(0, "CodetrailBandPad", { fg = band, default = true })
  vim.api.nvim_set_hl(0, "CodetrailBandPadStep", { fg = band, bg = tint, default = true })
  vim.api.nvim_set_hl(0, "CodetrailBandEdge", { fg = accent, default = true })
  vim.api.nvim_set_hl(0, "CodetrailBandPadEdge", { fg = accent, default = true })
  vim.api.nvim_set_hl(0, "CodetrailBandPadEdgeStep", { fg = accent, bg = tint, default = true })
  -- context steps are the tour's commentary, as the band is
  vim.api.nvim_set_hl(0, "CodetrailContext", { fg = accent, default = true })
  vim.api.nvim_set_hl(0, "CodetrailBadge", { fg = readable_on(accent, bg, fg), bg = accent, bold = true, default = true })
end

local function define()
  for name, link in pairs(LINKED) do
    vim.api.nvim_set_hl(0, name, { link = link, default = true })
  end
  for name, role in pairs(FOREGROUND) do
    local theme = vim.api.nvim_get_hl(0, { name = role.group, link = false })
    vim.api.nvim_set_hl(0, name, {
      fg = theme.fg,
      ctermfg = theme.ctermfg,
      italic = role.italic,
      bold = role.bold,
      default = true,
    })
  end
  define_mixed()
end

-- A colour scheme clears every group when it loads, so the roles are defined again after it.
function M.setup()
  define()
  vim.api.nvim_create_autocmd("ColorScheme", {
    group = vim.api.nvim_create_augroup("codetrail_highlights", { clear = true }),
    callback = define,
  })
end

return M
