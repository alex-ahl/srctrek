import { TextAttributes } from "@opentui/core"
import type { Item, ListLine } from "./list-lines"
import { type RowContext, RowView } from "./rows"
import { COLOUR, useTones } from "../ui/theme"
import { count } from "../ui/text"

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
  const tones = useTones()

  return (
    <text fg={tones.dim}>
      <span fg={selected ? tones.accent : tones.dim}>{open ? "▾ " : "▸ "}</span>
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
  const tones = useTones()
  if (line.kind === "gap") {
    return <text fg={COLOUR.text}> </text>
  }

  if (line.kind === "heading") {
    return <text fg={tones.dim}>{line.text}</text>
  }

  const isSelected = line.index === selected
  const { item } = line
  if (item.kind === "fold") {
    return <FoldView item={item} selected={isSelected} />
  }

  const row = <RowView row={item.row} selected={isSelected} context={context} />
  if (!isSelected || context.tint === undefined) {
    return row
  }

  return <box style={{ backgroundColor: context.tint }}>{row}</box>
}
