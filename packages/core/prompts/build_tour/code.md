Build a codetrail tour of code as it is, with no change: a debugger-style walkthrough that follows one example scenario through the code, in execution order, from what triggers it to how it ends. The reader steps through it in their editor to learn how the code works, so every step is a place in the code and every link between steps is backed by evidence.

## 1. Open and read the code

Call open_change with the args below; every repo is read as it is. Then find your way around: list_files for the layout, search for entry points (routes, CLI commands, message handlers, scheduled jobs), and read_file to follow the code from there. Read specs or docs in the repos when they explain the intent.

## 2. Choose the scenario

The user asked for this trigger, in their own words: "{{trigger}}". Find where it enters the code and follow it from there.

Make it concrete:

- the trigger: the request, command, event, or schedule that starts it, with real example input (an id, an amount, a payload);
- the outcome: what the scenario ends with (a response, a stored record, a message sent, a value shown).

One scenario per tour. Mention other paths in a step's details instead of following them.
