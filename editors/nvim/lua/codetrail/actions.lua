-- Every action the plugin offers; read at startup to define the commands, so it requires
-- nothing else.
return {
  { name = "next", command = "TrailNext", desc = "next step" },
  { name = "previous", command = "TrailPrev", desc = "previous step" },
  { name = "over", command = "TrailOver", desc = "step over" },
  { name = "into", command = "TrailInto", desc = "step into the call on the cursor's line" },
  { name = "out", command = "TrailOut", desc = "step out" },
  { name = "current", command = "TrailCurrent", desc = "back to the current step" },
  { name = "details", command = "TrailDetails", desc = "details: where it came from, flags, values" },
  { name = "ask", command = "TrailAsk", desc = "ask about this step" },
  { name = "values", command = "TrailValues", desc = "show or hide predicted values" },
  { name = "quit", command = "TrailQuit", desc = "end the tour" },
}
