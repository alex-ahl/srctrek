-- How each flag severity reads: its mark, its wording, and its colour.
local FLAGS = {
  high = { mark = "⚠", wording = "likely wrong", group = "SrctrekFlagHigh" },
  medium = { mark = "●", wording = "risky", group = "SrctrekFlagMedium" },
  low = { mark = "●", wording = "worth knowing", group = "SrctrekFlagLow" },
}

for _, flag in pairs(FLAGS) do
  flag.label = flag.mark .. " " .. flag.wording
end

return FLAGS
