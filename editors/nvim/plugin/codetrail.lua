-- Runs at startup: defines the commands and loads the rest of the plugin on first use.
vim.api.nvim_create_user_command("Trail", function(opts)
  require("codetrail").start(opts.args)
end, { nargs = 1, desc = "codetrail: step through a saved tour" })

for _, a in ipairs(require("codetrail.actions")) do
  vim.api.nvim_create_user_command(a.command, function()
    require("codetrail")[a.name]()
  end, { desc = "codetrail: " .. a.desc })
end
