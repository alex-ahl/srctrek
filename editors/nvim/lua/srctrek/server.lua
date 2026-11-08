-- The connection to `trek serve`, which loads tours and answers every move with the view to
-- draw. One server per Neovim, started in its working directory, where the tours were built.
local M = {}

local PROTOCOL_VERSION = 1
local CLIENT = { name = "srctrek.nvim", version = "0.0.0" }

local client = nil

local function report(message)
  vim.notify("srctrek: " .. message, vim.log.levels.ERROR)
end

-- Sends `method`; `on_result` gets the result, and an error is reported instead, then
-- `on_error` runs if given.
function M.request(method, params, on_result, on_error)
  if client == nil then
    report("trek serve isn't running")
    return
  end

  client.request(method, params, function(err, result)
    if err then
      report(err.message)
      if on_error then
        on_error()
      end
      return
    end

    on_result(result)
  end)
end

local function spawn(cmd)
  local started
  -- a server stopped on purpose, or since replaced, is no longer `client`
  local function on_exit(code)
    if client ~= started then
      return
    end

    client = nil
    vim.schedule(function()
      report(string.format("trek serve stopped (exit %d)", code))
    end)
  end

  local ok
  ok, started = pcall(vim.lsp.rpc.start, cmd, { on_exit = on_exit }, { cwd = vim.fn.getcwd() })
  if not ok then
    report("can't start " .. table.concat(cmd, " ") .. ": " .. tostring(started))
    return nil
  end

  return started
end

function M.stop()
  if client == nil then
    return
  end

  local stopped = client
  client = nil
  stopped.terminate()
end

-- Starts `cmd` and shakes hands; `on_ready` runs once the server has agreed, `on_failed` when
-- it can't start or disagrees. A server that disagrees, on the protocol version say, is
-- stopped: it would refuse everything after.
function M.start(cmd, on_ready, on_failed)
  if client ~= nil then
    on_ready()
    return
  end

  client = spawn(cmd)
  if client == nil then
    on_failed()
    return
  end

  client.request("initialize", { protocol_version = PROTOCOL_VERSION, client = CLIENT }, function(err)
    if err then
      report(err.message)
      M.stop()
      on_failed()
      return
    end

    on_ready()
  end)
end

return M
