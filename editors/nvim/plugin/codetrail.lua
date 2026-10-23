vim.api.nvim_create_user_command("Trail", function(opts)
  require("codetrail").start(opts.args)
end, { nargs = 1, complete = "file", desc = "codetrail: step through a tour" })
