Add steps to the tour, in execution order from trigger to outcome. Each step is a stop in one file:

- `id` (unique, such as "s4"), `repo` (a name from open_change), `file`, `start_line` and `end_line` (the lines this stop covers, numbered as read_file shows them).
- `kind`: call (execution enters code), return (it comes back), hop (it crosses to another process or repo: a request, a message, a job), or context (code read to understand, not executed).
- `summary` (one sentence) and `details` (what happens here and why it matters).
- `from`: the id of the step execution came from; absent only on the first step.
- `via`: the evidence for arriving here, as `{ cites: [{ repo, file, line }], guessed }`: the call site, route, config line, message name, or spec entry. Mark `guessed: true` when the link is only a name match. When `from` is in another repo, cite both repos or mark the link guessed. `null` only on the first step.
- `calls`: the id of the step this one steps into, if any. `trivial`: true for a step worth skipping. `uncertain`: `{ severity, note }` for a risk the reader should know (high: likely wrong behaviour; medium: risky; low: worth knowing).
- `predicted_values`: `{ name, value, line, role, uncertain? }`, role argument, assignment, or return, each on a line inside the step. Use the example scenario's values and keep their names the same across steps, so the reader can follow one value from where it's made to where it's used. Give a line a value when it tells the reader something or lets them follow the scenario (which repo, which record), setup lines included; leave out values that only restate a name. Mark a value you doubt `uncertain`.

Every line you cite is checked against the code. Steps are added all or none: when any has a problem, every problem comes back and nothing is added. Sending a step with an id already in the tour replaces it.
