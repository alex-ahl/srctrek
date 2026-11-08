-- Runs at startup: defines the commands and loads the rest of the plugin on first use.
vim.api.nvim_create_user_command("Trek", function(opts)
  require("srctrek").start(opts.args)
end, { nargs = 1, desc = "srctrek: step through a saved tour" })

for _, a in ipairs(require("srctrek.actions")) do
  vim.api.nvim_create_user_command(a.command, function()
    require("srctrek")[a.name]()
  end, { desc = "srctrek: " .. a.desc })
end
