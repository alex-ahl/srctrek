Build a trek of a change: a debugger-style walkthrough that follows one example scenario through the code, in execution order, from what triggers it to how it ends. The reader steps through it in their editor, so every step is a place in the code and every link between steps is backed by evidence.

## 1. Open and read the change

Call open_change with the args below. Then read the change: diff with no path lists the changed files; diff with a path shows a patch. Use read_file, search, and list_files to follow the code around it, in changed and unchanged files alike. Read specs, tickets, or docs in the repos when they explain the intent.

## 2. Choose one scenario

Pick the scenario that shows what the change is for, usually its main path. Make it concrete:

- the trigger: the request, command, event, or schedule that starts it, with real example input (an id, an amount, a payload);
- the outcome: what the scenario ends with (a response, a stored record, a message sent, a value shown).

In the trigger's input and the outcome, mark each of the example's values with « and »: `POST /refunds with { order: «o_1002», amount: «40» }`, `a ledger row of «4000» cents`. Mark the ids, amounts, names, and messages a reader follows from the trigger to the outcome, not the words around them; every « is closed by a ». Write both as they read, unescaped: a string's text as it shows, without backslashes, and a line break inside it as ↵.

One scenario per trek. Mention other paths in a step's details instead of following them.
