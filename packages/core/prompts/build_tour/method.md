## 3. Follow it in execution order

Trace what runs, step by step, from trigger to outcome:

- One step per stop: a handler, a function that decides something, a boundary crossed. Skip pure plumbing, or mark it `trivial`.
- Include all the code the path runs through, changed or not; the reader needs it to understand the parts that matter. When there is a change, it marks which lines it touches.
- `kind`: call when execution enters a function, including one reached from a return statement (`return render(turns)` is a call to `render`); return when execution comes back, bringing a value, to a function a step still on the call stack showed, such as the caller carrying on after the call; hop when it crosses to another process or repo (an HTTP request, a queued message, a job); context for code read to understand rather than executed (a type, a route table, a spec entry).
- The reader steps through a call stack built from these kinds, as in a debugger, so label what really calls what. A value handed on to another function is a call, not a return. An answer coming back to code that waits for it is a return, even from another process: the response to a request the caller awaits brings the reader back into the caller. Code that runs later, in response to something, is a hop even in the same process: a click or event handler, a timer, a callback registered earlier, a queue consumer, a scheduled job. An event emitted and handled at once, by a handler called right there, is a call. Follow it in the order it runs.
- Show a function once per visit: carry on with it after a call as a return, rather than as a second call.
- When the route leads into a repo that wasn't opened (a service the code calls, a consumer of a message it sends), propose the repo with propose_repo; once it's opened, follow the route on into it.

## 4. Link every step with evidence

Every step after the first names the step execution came from (`from`) and cites what proves the link (`via`): the call site, the route table, the config line, the spec entry. A name shared by both sides proves a link when both sides are cited: the same message topic where it's published and where it's consumed, the same URL path in the request and the route. A link is `guessed` only when nothing cited proves it, such as two names that merely look alike; then say in `details` what you assumed and which lines to compare to check it. A doubt left on a proven link, such as config that could differ between deployments, is a low flag, not a guess. A call through a lookup (a handler list, a registry, a table of routes or jobs, an interface) cites the call site, where the call happens, and where this target is registered or picked, which the call site alone doesn't show. A hop between repos cites both sides, or is guessed.

A context step isn't executed, so it sits outside that chain: it names the step it explains (`for`) instead of `from`, and cites the line there that uses it; across repos, both sides. A step after it still names where execution came from, never the context step.

## 5. Show the scenario's values

Add predicted values for the scenario on the lines where they help the reader follow it. First the values that decide where the flow goes: the branch taken, the handler picked, the check that passes or fails. Then what the flow carries on: the id, the amount, the result handed back. Write each as short as the reader needs it, `<button refund o_1001 499>` rather than the whole markup. Keep a value's name the same from step to step, so the reader can follow it from where it's made to where it's used. Include setup lines that create the scenario's pieces. Leave out values that only restate the code: a field passed straight through (`timeout = self.timeout`), a default left as it is (`prefix = ""`). Mark a value you doubt `uncertain`.

## 6. Flag only what matters

Use `uncertain` on a step for a real risk the reader should check: likely wrong behaviour (high), something risky (medium), something worth knowing (low). Flag sparingly: when most steps carry a flag, the one that matters is lost.

## 7. Write it

- `summary`: the narration. Most readers step from stop to stop and read only this, so it alone must tell the story. In two or three short sentences, plain words, the scenario's terms:
  - what happens here, and why it matters for the scenario: what this stop receives, decides, or hands on;
  - how it follows from the previous stop, above all after a return or a hop ("Once the api answers 202, the action…", "With the order found, …");
  - background code that explains it, named with the reason to look: "the order id and amount come from renderOrder, which drew the button";
  - on a step that crosses or implements a contract (a request, a message, a spec entry, a schema), the contract and the term in it that matters for the scenario: "the spec says amount is in minor units, and web sends 499".
- `details`: what the reader can't see from the code and doesn't need to follow the story: other paths, edge cases, why the code is built this way, what a guessed link assumes.
- `name`: for a step that receives a request, its route (`POST /refunds`), not the server's.
- The tour's `overview` says what the change does (or, for code as it is, what the code is for) and what the tour follows. `title` names what the change does in a few words ("Refunding an order"); the route belongs in the overview.

Call start_tour, then add_steps (in batches, in order), then finish_tour with a short name after the branch or feature (lowercase letters, digits, and dashes). When a call reports problems, fix those steps and send them again under the same ids; nothing is kept from a rejected batch.

## What to open

Open it with open_change and these args: {{args}}
