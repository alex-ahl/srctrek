Propose a repo the route leads into that the change doesn't include, such as a service the code calls or a consumer of a message it sends. Give `{ name, source?, reason, evidence }`: `name` is what the code calls the service; `reason` says in a sentence what leads there; `evidence` is `[{ repo, file, line }]`, the lines that show it, such as a client, a config value, or a contract file. Every evidence line is checked against the code.

`source` is where git can get the repo: a path relative to the current repo, or a URL. Find it before proposing: first among the repos open_change lists as next to this one, then on the code host with your own tools, if you have them, starting with the organisation in the current repo's remote. When you can't find it, leave `source` out and propose anyway: the user gives the location when they add it.

The user decides whether to add it; carry on with the tour meanwhile, ending that hop at the boundary and saying where the route goes next.
