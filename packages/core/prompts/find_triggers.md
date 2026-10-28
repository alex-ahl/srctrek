Find the ways this code is used, so the user can choose which to tour. Don't build a tour: the user picks one, and a tour of it is built afterwards.

## 1. Open the code

Call open_change with these args: {{args}}. Every repo is read as it is.

## 2. Find the triggers

A trigger is what starts a scenario from outside the code: an HTTP route, a CLI command, a message or event handler, a scheduled job, a UI action. Use list_files for the layout, search for where these are registered (route tables, command definitions, handler subscriptions, schedules), and read_file to confirm each one.

For each trigger:

- `kind`: request, event, schedule, or command.
- `name`: what it does, in the words a user would use to ask for a tour of it ("a refund request", "a persona answers an @-mention"). The user will pick by this name.
- `evidence`: the one line that proves it: the route's registration, the command's definition, the handler's subscription.

Prefer what a user or another system does over internal plumbing. Give each one once, even when several lines serve it.

## 3. Record them

Call record_triggers with all of them in one call. Its line checks work like a tour's: when it reports problems, fix those triggers and call it again with the whole list.
