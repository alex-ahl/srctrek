import { TextAttributes } from "@opentui/core"
import type { Item, ListLine } from "./list-lines"
import { type RowContext, RowView } from "./rows"
import { COLOUR } from "./theme"
import { count } from "./text"

// A folding section's heading where other headings sit, "▸ DONE  31 treks", which enter opens or
// closes; selected, its arrow takes the selection's colour and its title is bold.
function FoldView({
  item,
  selected,
}: {
  item: Extract<Item, { kind: "fold" }>
  selected: boolean
}) {
  const { section, open } = item

  return (
    <text fg={COLOUR.dim}>
      <span fg={selected ? COLOUR.accent : COLOUR.dim}>{open ? "▾ " : "▸ "}</span>
      <span {...(selected ? { attributes: TextAttributes.BOLD } : {})}>{section.title}</span>
      {`  ${count(section.rows.length, "trek")}`}
    </text>
  )
}

/** One line of the list: a gap, a section's heading, a fold, or a row. */
export function ListLineView({
  line,
  selected,
  context,
}: {
  line: ListLine
  selected: number
  context: RowContext
}) {
  if (line.kind === "gap") {
    return <text fg={COLOUR.text}> </text>
  }

  if (line.kind === "heading") {
    return <text fg={COLOUR.dim}>{line.text}</text>
  }

  const isSelected = line.index === selected
  const { item } = line
  if (item.kind === "fold") {
    return <FoldView item={item} selected={isSelected} />
  }

  return <RowView row={item.row} selected={isSelected} context={context} />
}
