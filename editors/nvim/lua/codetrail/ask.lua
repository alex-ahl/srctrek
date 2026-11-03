-- Asking about the current step: runs the user's agent headless with the step as context.
local popup = require("codetrail.popup")
local state = require("codetrail.state")

local M = {}

-- The argv for $CODETRAIL_AGENT and a display name, or nil when it isn't set. The prompt is
-- appended as its last argument.
local function agent_cmd()
  local configured = vim.env.CODETRAIL_AGENT
  if not configured or configured == "" then
    return nil
  end
  -- not an interactive shell: that sources the user's rc, which can run tmux commands
  -- against the live server. The prompt travels in an env var to avoid quoting it.
  return { "sh", "-c", configured .. ' "$CODETRAIL_PROMPT"' }, configured:match("^%S+")
end

-- A frame by the function it shows, or by its place when the tour doesn't name it.
local function frame_label(frame)
  return frame.name ~= vim.NIL and frame.name or string.format("%s/%s:%d", frame.repo, frame.file, frame.start_line)
end

local function prompt_for(question)
  local view, overview = state.view, state.overview
  local repos = {}
  for name, root in pairs(state.roots) do
    table.insert(repos, "- " .. name .. ": " .. root)
  end
  local context = {
    "You are helping a developer review a change by stepping through a code trail: a walkthrough",
    "of one example scenario, in execution order, across these repos:",
    table.concat(repos, "\n"),
    "Read the code to answer. Do not run anything or modify files.",
    "",
    "Trail: " .. overview.title,
    "Scenario: " .. overview.trigger.input,
    "",
  }
  if view.kind == "step" then
    local v = view
    vim.list_extend(context, {
      string.format("Current stop %d of %d: %s/%s lines %d-%d", v.number, v.count, v.repo, v.file, v.start_line, v.end_line),
      "Summary: " .. v.summary,
      "Details: " .. v.details,
      "Call stack: " .. table.concat(vim.tbl_map(frame_label, v.stack), " > "),
      "",
    })
  end
  vim.list_extend(context, {
    "Question: " .. question,
    "",
    "Answer in at most 12 short lines of markdown. Put the 2-3 points that matter most in",
    "**bold**; no headings. Cite code as <repo>/<path>:<line>, using the repo names above.",
    "Label any runtime value as predicted: you read code, you did not run it. Say so plainly",
    "when you are unsure.",
  })
  return table.concat(context, "\n")
end

-- A popup with a spinner and elapsed seconds; returns a function that closes it.
local function show_waiting(name, question)
  local buf = popup.float({ "Asking " .. name .. " …", "", question }, "asking")
  local win = vim.api.nvim_get_current_win()
  local frames = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }
  local started, tick = vim.uv.now(), 0
  local timer = vim.uv.new_timer()
  timer:start(0, 100, vim.schedule_wrap(function()
    if not vim.api.nvim_buf_is_valid(buf) then
      return
    end
    tick = tick + 1
    local line = string.format("%s Asking %s … %ds", frames[tick % #frames + 1], name, math.floor((vim.uv.now() - started) / 1000))
    vim.bo[buf].modifiable = true
    vim.api.nvim_buf_set_lines(buf, 0, 1, false, { line })
    vim.bo[buf].modifiable = false
  end))
  return function()
    timer:stop()
    timer:close()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end
end

local function answer_text(res, argv)
  local answer = vim.trim(res.stdout or "")
  if res.code == 0 then
    return answer
  end
  return table.concat({
    string.format("agent failed (exit %d): %s", res.code, table.concat(argv, " "):sub(1, 120)),
    "stdout: " .. answer,
    "stderr: " .. vim.trim(res.stderr or ""),
  }, "\n")
end

local function run(question, argv, name)
  local view = state.view
  local stop_waiting = show_waiting(name, question)
  local prompt = prompt_for(question)
  local env = { CODETRAIL_PROMPT = prompt }
  local cwd = view.kind == "step" and state.roots[view.repo] or vim.fn.getcwd()
  vim.system(argv, { cwd = cwd, text = true, env = env }, function(res)
    vim.schedule(function()
      stop_waiting()
      local answer = answer_text(res, argv)
      -- kept on the step, for its details; the overview and the end have none
      if view.kind == "step" then
        state.notes[view.id] = state.notes[view.id] or {}
        table.insert(state.notes[view.id], { question = question, answer = answer })
      end
      popup.markdown(vim.list_extend({ "**Q:** " .. question, "" }, vim.split(answer, "\n")), "answer")
    end)
  end)
end

function M.ask()
  local argv, name = agent_cmd()
  if not argv then
    vim.notify("codetrail: set CODETRAIL_AGENT to your agent's headless command", vim.log.levels.ERROR)
    return
  end
  vim.ui.input({ prompt = "Ask about this step: " }, function(question)
    if question and question ~= "" then
      run(question, argv, name)
    end
  end)
end

return M
