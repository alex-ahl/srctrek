-- Asking about the current step: runs the user's agent headless with the step as context.
local popup = require("codetrail.popup")
local state = require("codetrail.state")

local M = {}

-- Returns the argv to run, a display name, and whether the prompt goes in through the
-- environment rather than as the last argument.
local function agent_cmd()
  local configured = vim.env.CODETRAIL_AGENT
  if configured and configured ~= "" then
    -- not an interactive shell: that sources the user's rc, which can run tmux commands
    -- against the live server. The prompt travels in an env var to avoid quoting it.
    return { "sh", "-c", configured .. ' "$CODETRAIL_PROMPT"' }, configured:match("^%S+"), true
  end
  for _, candidate in ipairs({ { "claude", "-p" }, { "codex", "exec" }, { "opencode", "run" } }) do
    if vim.fn.executable(candidate[1]) == 1 then
      return candidate, candidate[1], false
    end
  end
end

local function prompt_for(question)
  local t = state.tour
  local s = t.steps[state.index]
  local stack = {}
  for _, i in ipairs(state.stack) do
    table.insert(stack, t.steps[i].id)
  end
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
    "Trail: " .. t.title,
    "Scenario: " .. t.trigger.input,
    "",
  }
  if s then
    vim.list_extend(context, {
      string.format("Current step %s (%d of %d): %s/%s lines %d-%d", s.id, state.index, #t.steps, s.repo, s.file, s.start_line, s.end_line),
      "Summary: " .. s.summary,
      "Details: " .. s.details,
      "Call stack: " .. table.concat(stack, " > "),
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

local function run(question, cmd, name, via_shell)
  local index = state.index
  local stop_waiting = show_waiting(name, question)
  local prompt = prompt_for(question)
  local argv = via_shell and cmd or vim.list_extend(vim.deepcopy(cmd), { prompt })
  local env = via_shell and { CODETRAIL_PROMPT = prompt } or nil
  local cwd = state.roots[(state.tour.steps[index] or state.tour.steps[1]).repo]
  vim.system(argv, { cwd = cwd, text = true, env = env }, function(res)
    vim.schedule(function()
      stop_waiting()
      local answer = answer_text(res, argv)
      state.notes[index] = state.notes[index] or {}
      table.insert(state.notes[index], { question = question, answer = answer })
      popup.markdown(vim.list_extend({ "**Q:** " .. question, "" }, vim.split(answer, "\n")), "answer")
    end)
  end)
end

function M.ask()
  if not state.tour then
    return
  end
  local cmd, name, via_shell = agent_cmd()
  if not cmd then
    vim.notify("codetrail: no agent CLI found; set CODETRAIL_AGENT", vim.log.levels.ERROR)
    return
  end
  vim.ui.input({ prompt = "Ask about this step: " }, function(question)
    if question and question ~= "" then
      run(question, cmd, name, via_shell)
    end
  end)
end

return M
