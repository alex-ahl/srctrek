-- codetrail for Neovim: step through a tour with the editor following.
--   :Trail path/to/tour.json
--   ]t / [t next / previous step     <leader>ti step into   <leader>to step out
--   <leader>tt details (overview before step 1)               <leader>tq quit
--   <leader>ta ask about the current step (enter on a cited repo/file:line jumps there)
-- Asking runs $CODETRAIL_AGENT with sh -c (no shell rc, so no aliases), else the first of
-- claude, codex, opencode on PATH. Each step fires `User CodetrailStep` with
-- { path, line, repo } for file explorers or user config to follow.
local M = {}
local ns = vim.api.nvim_create_namespace("codetrail")

-- Linked to theme groups, so the colours follow the user's colour scheme.
for name, link in pairs({
  CodetrailStep = "CursorLine",
  CodetrailSummary = "DiagnosticInfo",
  CodetrailWarn = "DiagnosticWarn",
  CodetrailMuted = "Comment",
  CodetrailAdded = "Added",
  CodetrailChanged = "Changed",
  CodetrailCitation = "Underlined",
}) do
  vim.api.nvim_set_hl(0, name, { link = link, default = true })
end

local function read_json(path)
  return vim.fn.json_decode(table.concat(vim.fn.readfile(path), "\n"))
end


local function fit(text, width)
  if vim.fn.strdisplaywidth(text) <= width then
    return text
  end
  return vim.fn.strcharpart(text, 0, width - 1) .. "…"
end

-- Word-wraps `text` to `width` columns, at most `max` lines; continuation lines are indented
-- by `indent` so they line up under the text after the leading marker.
local function wrap(text, width, max, indent)
  local lines, current = {}, ""
  for word in text:gmatch("%S+") do
    local candidate = current == "" and word or (current .. " " .. word)
    local limit = #lines == 0 and width or (width - #indent)
    if vim.fn.strdisplaywidth(candidate) > limit and current ~= "" then
      table.insert(lines, current)
      current = word
    else
      current = candidate
    end
  end
  table.insert(lines, current)
  if #lines > max then
    lines = vim.list_slice(lines, 1, max)
    lines[max] = fit(lines[max] .. " …", width - #indent)
  end
  for i = 2, #lines do
    lines[i] = indent .. lines[i]
  end
  return lines
end

local function clear()
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_valid(buf) then
      vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)
    end
  end
end

local function show(step)
  clear()
  vim.cmd("edit " .. vim.fn.fnameescape(step.path))
  local buf = vim.api.nvim_get_current_buf()
  local last = vim.api.nvim_buf_line_count(buf)
  local s, e = math.min(step.start_line, last), math.min(step.end_line, last)

  for l = s, e do
    vim.api.nvim_buf_set_extmark(buf, ns, l - 1, 0, { line_hl_group = "CodetrailStep" })
  end

  local file_changes = (step.changes[step.repo] or {})[step.file] or {}
  for line, kind in pairs(file_changes) do
    local l = tonumber(line)
    if l <= last then
      vim.api.nvim_buf_set_extmark(buf, ns, l - 1, 0, {
        sign_text = kind == "added" and "+" or "~",
        sign_hl_group = kind == "added" and "CodetrailAdded" or "CodetrailChanged",
      })
    end
  end

  -- Virtual lines don't wrap, so the text is wrapped here, up to three lines each; the full
  -- text is in the details view. The sign column may appear only after this redraw, so its
  -- two columns are reserved up front.
  local width = vim.api.nvim_win_get_width(0) - vim.fn.getwininfo(vim.api.nvim_get_current_win())[1].textoff - 4
  local lines = {}
  for _, l in ipairs(wrap("▶ " .. step.summary, width, 3, "  ")) do
    table.insert(lines, { { l, "CodetrailSummary" } })
  end
  if not step.changed then
    table.insert(lines[#lines], { "  unchanged", "CodetrailMuted" })
  end
  -- only high-severity flags show inline; the rest are in the details view
  local flag = step.uncertain
  if flag and flag ~= vim.NIL and flag.severity == "high" then
    for _, l in ipairs(wrap("⚠ " .. flag.note, width, 3, "  ")) do
      table.insert(lines, { { l, "CodetrailWarn" } })
    end
  end
  vim.api.nvim_buf_set_extmark(buf, ns, s - 1, 0, { virt_lines = lines, virt_lines_above = true })

  vim.api.nvim_win_set_cursor(0, { s, 0 })
  vim.cmd("normal! zz")
  -- virtual lines above the first line stay hidden unless the window is scrolled to show them
  if s == 1 then
    vim.fn.winrestview({ topline = 1, topfill = #lines })
  end
end

-- Stepping from inside the editor.
local trail = { tour = nil, index = 0, stack = {}, by_id = {}, roots = {}, changed = {}, notes = {} }

-- A repo's source is a local directory, absolute or relative to Neovim's working directory.
-- Returns nil and the first repo whose source isn't one.
local function repo_roots(tour)
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

local function step_at(i)
  local s = vim.deepcopy(trail.tour.steps[i])
  s.path = trail.roots[s.repo] .. "/" .. s.file
  s.changes = trail.changed
  return s
end

local function winbar()
  local s = trail.tour.steps[trail.index]
  local ids = {}
  for _, i in ipairs(trail.stack) do
    table.insert(ids, trail.tour.steps[i].id)
  end
  table.insert(ids, s.id)
  vim.wo.winbar = string.format(
    " codetrail  %d/%d  ·  %s/%s:%d  ·  %s  ·  %s",
    trail.index,
    #trail.tour.steps,
    s.repo,
    s.file,
    s.start_line,
    s.kind,
    table.concat(ids, " › ")
  )
end

-- Each step fires `User CodetrailStep` with { path, line, repo }; anything may listen.
local function announce(step)
  vim.api.nvim_exec_autocmds("User", {
    pattern = "CodetrailStep",
    data = { path = step.path, line = step.start_line, repo = step.repo },
  })
end

local function go(i)
  if not trail.tour or i < 1 or i > #trail.tour.steps then
    return
  end
  if vim.api.nvim_win_get_config(0).relative ~= "" then
    vim.cmd("close")
  end
  trail.index = i
  local step = step_at(i)
  show(step)
  winbar()
  announce(step)
end

local function float(lines, title)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  local width = math.min(110, math.floor(vim.o.columns * 0.8))
  -- height in screen rows: long lines wrap, so count each one's wrapped rows
  local rows = 0
  for _, l in ipairs(lines) do
    rows = rows + math.max(1, math.ceil(vim.fn.strdisplaywidth(l) / (width - 6)))
  end
  local height = math.min(rows, math.floor(vim.o.lines * 0.8))
  vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = math.floor((vim.o.lines - height) / 2) - 1,
    col = math.floor((vim.o.columns - width) / 2),
    border = "rounded",
    title = " " .. (title or "codetrail") .. " ",
  })
  vim.wo.wrap = true
  vim.wo.linebreak = true
  vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = buf })
  vim.keymap.set("n", "<esc>", "<cmd>close<cr>", { buffer = buf })
  return buf
end

-- A citation reads <repo>/<path>:<line>; the repo name picks the root.
local function jump_to_citation()
  local word = vim.fn.expand("<cWORD>")
  local repo, path, line = word:match("([%w_%-%.]+)/([%w_%-%./]+%.%w+):(%d+)")
  local root = repo and trail.roots[repo]
  if not root or vim.fn.filereadable(root .. "/" .. path) == 0 then
    return
  end
  vim.cmd("close")
  vim.cmd("edit " .. vim.fn.fnameescape(root .. "/" .. path))
  vim.api.nvim_win_set_cursor(0, { tonumber(line), 0 })
  vim.cmd("normal! zz")
end

local function markdown_float(lines, title)
  local buf = float(lines, title)
  vim.bo[buf].filetype = "markdown"
  vim.wo.conceallevel = 2
  local names = vim.tbl_map(function(n)
    return vim.fn.escape(n, [[\.]])
  end, vim.tbl_keys(trail.roots))
  vim.fn.matchadd("CodetrailCitation", [[\v<(]] .. table.concat(names, "|") .. [[)/[[:alnum:]_./-]+:\d+]])
  vim.keymap.set("n", "<cr>", jump_to_citation, { buffer = buf })
  return buf
end

local function present(v)
  return v ~= nil and v ~= vim.NIL
end

local finish

local function details()
  local t = trail.tour
  if trail.index > #t.steps then
    finish()
    return
  end
  if trail.index == 0 then
    markdown_float({
      "**Trigger** (" .. t.trigger.kind .. "): " .. t.trigger.input,
      "",
      "**Outcome:** " .. t.outcome,
      "",
      t.overview,
      "",
      "_" .. #t.steps .. " steps · ]t to start_",
    }, t.title)
    return
  end
  local s = t.steps[trail.index]
  local lines = { "**" .. s.summary .. "**", "", s.details }
  if present(s.via) then
    local cites = vim.tbl_map(function(c)
      return string.format("%s/%s:%d", c.repo, c.file, c.line)
    end, s.via.cites)
    vim.list_extend(lines, { "", "**Evidence:** " .. table.concat(cites, ", ") .. (s.via.guessed and "  _guessed_" or "") })
  end
  if present(s.predicted_values) then
    vim.list_extend(lines, { "", "**Predicted values**" })
    for k, v in pairs(s.predicted_values) do
      local value = tostring(v):gsub("%s*%(predicted%)$", "")
      table.insert(lines, "- `" .. k .. "` = `" .. value .. "` _(predicted)_")
    end
  end
  if present(s.uncertain) then
    vim.list_extend(lines, { "", "> ⚠ **" .. s.uncertain.severity .. ":** " .. s.uncertain.note })
  end
  local notes = trail.notes[trail.index] or {}
  if #notes > 0 then
    vim.list_extend(lines, { "", "---", "", "**Questions**" })
    for _, note in ipairs(notes) do
      vim.list_extend(lines, { "", "**Q:** " .. note.question, "" })
      vim.list_extend(lines, vim.split(note.answer, "\n"))
    end
  end
  local title = string.format("%s · %s · %s · %s", s.id, s.repo, s.kind, s.changed and "changed" or "unchanged")
  markdown_float(lines, title)
end

local SEVERITY_ORDER = { high = 1, medium = 2, low = 3 }

local function flag_lines(steps)
  local flagged = vim.tbl_filter(function(s)
    return s.uncertain and s.uncertain ~= vim.NIL
  end, steps)
  table.sort(flagged, function(a, b)
    return SEVERITY_ORDER[a.uncertain.severity] < SEVERITY_ORDER[b.uncertain.severity]
  end)
  return vim.tbl_map(function(s)
    return string.format("- ⚠ **%s** %s/%s:%d: %s", s.uncertain.severity, s.repo, s.file, s.start_line, s.uncertain.note)
  end, flagged)
end

local function question_lines()
  local lines = {}
  for i = 1, #trail.tour.steps do
    for _, note in ipairs(trail.notes[i] or {}) do
      vim.list_extend(lines, { "", "**" .. trail.tour.steps[i].id .. " · Q:** " .. note.question, "" })
      vim.list_extend(lines, vim.split(note.answer, "\n"))
    end
  end
  return lines
end

local function restart()
  if vim.api.nvim_win_get_config(0).relative ~= "" then
    vim.cmd("close")
  end
  clear()
  vim.wo.winbar = ""
  trail.index, trail.stack = 0, {}
  details()
end

-- The end screen sits one position past the last step, so [t returns to that step.
finish = function()
  local t = trail.tour
  trail.index = #t.steps + 1
  local lines = { "**End of trail.** " .. t.outcome }
  local flags = flag_lines(t.steps)
  if #flags > 0 then
    vim.list_extend(lines, { "", "**Flags**" })
    vim.list_extend(lines, flags)
  end
  local questions = question_lines()
  if #questions > 0 then
    vim.list_extend(lines, { "", "**Questions**" })
    vim.list_extend(lines, questions)
  end
  vim.list_extend(lines, { "", "_[t last step · gg restart · <leader>tq end tour · enter on a citation jumps_" })
  local buf = markdown_float(lines, t.title)
  vim.keymap.set("n", "gg", restart, { buffer = buf })
end

local function next_step()
  if trail.tour and trail.index == #trail.tour.steps then
    finish()
  else
    go(trail.index + 1)
  end
end

-- Asking: runs the user's agent headless in the repos' root with the step as context.
-- Returns the argv to run and a display name; the prompt reaches it as the last argument.
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

local function ask_prompt(question)
  local t = trail.tour
  local s = t.steps[trail.index]
  local stack = {}
  for _, i in ipairs(trail.stack) do
    table.insert(stack, t.steps[i].id)
  end
  local repos = {}
  for name, root in pairs(trail.roots) do
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
      string.format("Current step %s (%d of %d): %s/%s lines %d-%d", s.id, trail.index, #t.steps, s.repo, s.file, s.start_line, s.end_line),
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


local function ask()
  if not trail.tour then
    return
  end
  local cmd, name, via_shell = agent_cmd()
  if not cmd then
    vim.notify("codetrail: no agent CLI found; set CODETRAIL_AGENT", vim.log.levels.ERROR)
    return
  end
  vim.ui.input({ prompt = "Ask about this step: " }, function(question)
    if not question or question == "" then
      return
    end
    local index = trail.index
    local waiting_buf = float({ "Asking " .. name .. " …", "", question }, "asking")
    local waiting = vim.api.nvim_get_current_win()
    local frames = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }
    local started, tick = vim.uv.now(), 0
    local timer = vim.uv.new_timer()
    timer:start(0, 100, vim.schedule_wrap(function()
      if not vim.api.nvim_buf_is_valid(waiting_buf) then
        return
      end
      tick = tick + 1
      local line = string.format("%s Asking %s … %ds", frames[tick % #frames + 1], name, math.floor((vim.uv.now() - started) / 1000))
      vim.bo[waiting_buf].modifiable = true
      vim.api.nvim_buf_set_lines(waiting_buf, 0, 1, false, { line })
      vim.bo[waiting_buf].modifiable = false
    end))
    local prompt = ask_prompt(question)
    local argv = via_shell and cmd or vim.list_extend(vim.deepcopy(cmd), { prompt })
    local env = via_shell and { CODETRAIL_PROMPT = prompt } or nil
    local cwd = trail.roots[(trail.tour.steps[index] or trail.tour.steps[1]).repo]
    vim.system(argv, { cwd = cwd, text = true, env = env }, function(res)
      vim.schedule(function()
        timer:stop()
        timer:close()
        if vim.api.nvim_win_is_valid(waiting) then
          vim.api.nvim_win_close(waiting, true)
        end
        local answer = vim.trim(res.stdout or "")
        if res.code ~= 0 then
          answer = table.concat({
            string.format("agent failed (exit %d): %s", res.code, table.concat(argv, " "):sub(1, 120)),
            "stdout: " .. answer,
            "stderr: " .. vim.trim(res.stderr or ""),
          }, "\n")
        end
        trail.notes[index] = trail.notes[index] or {}
        table.insert(trail.notes[index], { question = question, answer = answer })
        markdown_float(vim.list_extend({ "**Q:** " .. question, "" }, vim.split(answer, "\n")), "answer")
      end)
    end)
  end)
end

local function into()
  local s = trail.tour and trail.tour.steps[trail.index]
  local target = s and s.calls and trail.by_id[s.calls]
  if target then
    table.insert(trail.stack, trail.index)
    go(target)
  end
end

local function out()
  local caller = table.remove(trail.stack)
  if caller then
    go(caller)
  end
end

local function quit()
  clear()
  vim.wo.winbar = ""
  for _, lhs in ipairs({ "]t", "[t", "<leader>ti", "<leader>to", "<leader>tt", "<leader>ta", "<leader>tq" }) do
    pcall(vim.keymap.del, "n", lhs)
  end
  trail.tour = nil
end

-- Lines the change touches come from <tour>.changed.json beside the tour, when present:
-- { [repo] = { [file] = { [line] = "added" | "changed" } } }.
function M.start(path)
  trail.tour = read_json(path)
  local roots, missing = repo_roots(trail.tour)
  if not roots then
    vim.notify("codetrail: repo " .. missing.name .. " not found at " .. missing.source, vim.log.levels.ERROR)
    trail.tour = nil
    return
  end
  trail.roots = roots
  local changed_path = path:gsub("%.json$", ".changed.json")
  trail.changed = vim.fn.filereadable(changed_path) == 1 and read_json(changed_path) or {}
  trail.index, trail.stack, trail.by_id, trail.notes = 0, {}, {}, {}
  for i, s in ipairs(trail.tour.steps) do
    trail.by_id[s.id] = i
  end
  local map = function(lhs, fn, desc)
    vim.keymap.set("n", lhs, fn, { desc = "codetrail: " .. desc })
  end
  map("]t", next_step, "next step")
  map("[t", function()
    go(trail.index - 1)
  end, "previous step")
  map("<leader>ti", into, "step into")
  map("<leader>to", out, "step out")
  map("<leader>tt", details, "details")
  map("<leader>ta", ask, "ask about this step")
  map("<leader>tq", quit, "quit")
  details()
end

return M
