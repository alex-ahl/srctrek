-- Each role of the visual language takes its colour from a group the theme defines, so the
-- colours follow the user's colour scheme; set a role's group to override it.
local M = {}

local LINKED = {
  CodetrailStep = "ColorColumn",
  CodetrailNarration = "Normal",
  CodetrailUnchanged = "Comment",
  CodetrailFlagHigh = "DiagnosticError",
  CodetrailStale = "DiagnosticWarn",
  CodetrailHop = "Comment",
  CodetrailContext = "Comment",
  CodetrailAway = "Comment",
  CodetrailCitation = "Underlined",
}

-- Text at the end of a line or in the gutter takes only its group's foreground: themes often
-- give these groups a background (inlay hints, diff lines), which draws a box there. The
-- step's bar takes the colour of its tint.
local FOREGROUND = {
  CodetrailStepBar = { group = "ColorColumn", colour = "bg" },
  CodetrailCurrent = { group = "DiagnosticWarn" },
  CodetrailAdded = { group = "Added" },
  CodetrailChanged = { group = "Changed" },
  CodetrailPredicted = { group = "LspInlayHint", italic = true },
  CodetrailDoubtful = { group = "DiagnosticWarn", italic = true },
  CodetrailCall = { group = "Special" },
}

local function define()
  for name, link in pairs(LINKED) do
    vim.api.nvim_set_hl(0, name, { link = link, default = true })
  end
  for name, role in pairs(FOREGROUND) do
    local theme = vim.api.nvim_get_hl(0, { name = role.group, link = false })
    local from_bg = role.colour == "bg"
    vim.api.nvim_set_hl(0, name, {
      fg = from_bg and theme.bg or theme.fg,
      ctermfg = from_bg and theme.ctermbg or theme.ctermfg,
      italic = role.italic,
      default = true,
    })
  end
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
