## 3. Follow it in execution order

Trace what runs, step by step, from trigger to outcome:

- One step per stop: a handler, a function that decides something, a boundary crossed. Skip pure plumbing, or mark it `trivial`.
- Include all the code the path runs through, changed or not; the reader needs it to understand the parts that matter. When there is a change, it marks which lines it touches.
- `kind`: call when execution enters a function, including one reached from a return statement (`return render(turns)` is a call to `render`); return when execution comes back to code an earlier step showed, bringing a value; hop when it crosses to another process or repo (an HTTP request, a queued message, a job); context for code read to understand rather than executed.
- When work happens later (a queue consumer, a scheduled job), follow it as a hop, in the order it runs.
- When the route leads into a repo that wasn't opened (a service the code calls, a consumer of a message it sends), end the hop at the boundary and propose the repo with propose_repo.

## 4. Link every step with evidence

Every step after the first names the step execution came from (`from`) and cites what proves the link (`via`): the call site, the route table, the config line, the message name on both sides, the spec entry. A link matched only by a name (a topic string, a URL path) is `guessed`. A hop between repos cites both sides, or is guessed.

## 5. Show the scenario's values

Add predicted values for the scenario on the lines where they help the reader follow it: arguments as a function receives them, assignments that shape the result, return values. Keep a value's name the same from step to step, so the reader can follow it from where it's made to where it's used. Include setup lines that create the scenario's pieces. Leave out values that only restate the code: a field passed straight through (`timeout = self.timeout`), a default left as it is (`prefix = ""`). Mark a value you doubt `uncertain`.

## 6. Flag only what matters

Use `uncertain` on a step for a real risk the reader should check: likely wrong behaviour (high), something risky (medium), something worth knowing (low). Flag sparingly: when most steps carry a flag, the one that matters is lost.

## 7. Write it

- `summary`: one sentence, what happens here, in the scenario's terms.
- `details`: why it matters, what to notice, and anything the reader can't see from the code.
- The tour's `overview` says what the change does (or, for code as it is, what the code is for) and what the tour follows; `title` names it.

Call start_tour, then add_steps (in batches, in order), then finish_tour with a short name after the branch or feature (lowercase letters, digits, and dashes). When a call reports problems, fix those steps and send them again under the same ids; nothing is kept from a rejected batch.

## What to open

Open it with open_change and these args: {{args}}
