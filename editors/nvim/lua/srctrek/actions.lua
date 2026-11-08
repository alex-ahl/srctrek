-- Every action the plugin offers; read at startup to define the commands, so it requires
-- nothing else.
return {
  { name = "next", command = "TrekNext", desc = "next step" },
  { name = "previous", command = "TrekPrev", desc = "previous step" },
  { name = "over", command = "TrekOver", desc = "step over" },
  { name = "into", command = "TrekInto", desc = "step into the call on the cursor's line" },
  { name = "out", command = "TrekOut", desc = "step out" },
  { name = "current", command = "TrekCurrent", desc = "back to the current step" },
  { name = "context", command = "TrekContext", desc = "context code: contracts, types, where data came from" },
  { name = "details", command = "TrekDetails", desc = "details: where it came from, flags, values" },
  { name = "values", command = "TrekValues", desc = "show or hide predicted values" },
  { name = "quit", command = "TrekQuit", desc = "end the trek" },
}
