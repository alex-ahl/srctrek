Build a codetrail tour of a change: a debugger-style walkthrough that follows one example scenario through the code, in execution order, from what triggers it to how it ends. The reader steps through it in their editor, so every step is a place in the code and every link between steps is backed by evidence.

## 1. Open and read the change

Call open_change with the args below. Then read the change: diff with no path lists the changed files; diff with a path shows a patch. Use read_file, search, and list_files to follow the code around it, in changed and unchanged files alike. Read specs, tickets, or docs in the repos when they explain the intent.

## 2. Choose one scenario

Pick the scenario that shows what the change is for, usually its main path. Make it concrete:

- the trigger: the request, command, event, or schedule that starts it, with real example input (an id, an amount, a payload);
- the outcome: what the scenario ends with (a response, a stored record, a message sent, a value shown).

One scenario per tour. Mention other paths in a step's details instead of following them.

## 3. Follow it in execution order

Trace what runs, step by step, from trigger to outcome:

- One step per stop: a handler, a function that decides something, a boundary crossed. Skip pure plumbing, or mark it `trivial`.
- Include unchanged code the path runs through; the reader needs it to understand the changed parts. The change marks which lines it touches.
- `kind`: call when execution enters code, return when it comes back, hop when it crosses to another process or repo (an HTTP request, a queued message, a job), context for code read to understand rather than executed.
- When work happens later (a queue consumer, a scheduled job), follow it as a hop, in the order it runs.

## 4. Link every step with evidence

Every step after the first names the step execution came from (`from`) and cites what proves the link (`via`): the call site, the route table, the config line, the message name on both sides, the spec entry. A link matched only by a name (a topic string, a URL path) is `guessed`. A hop between repos cites both sides, or is guessed.

## 5. Show the scenario's values

Add predicted values for the scenario on the lines where they help the reader follow it: arguments as a function receives them, assignments that shape the result, return values. Keep a value's name the same from step to step, so the reader can follow it from where it's made to where it's used. Include setup lines that create the scenario's pieces. Leave out values that only restate a name. Mark a value you doubt `uncertain`.

## 6. Flag only what matters

Use `uncertain` on a step for a real risk the reader should check: likely wrong behaviour (high), something risky (medium), something worth knowing (low). Flag sparingly: when most steps carry a flag, the one that matters is lost.

## 7. Write it

- `summary`: one sentence, what happens here, in the scenario's terms.
- `details`: why it matters, what to notice, and anything the reader can't see from the code.
- The tour's `overview` says what the change does and what the tour follows; `title` names it.

Call start_tour, then add_steps (in batches, in order), then finish_tour with a short name after the branch or feature (lowercase letters, digits, and dashes). When a call reports problems, fix those steps and send them again under the same ids; nothing is kept from a rejected batch.

## The change

Open it with open_change and these args: {{args}}
