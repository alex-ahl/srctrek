import type { StepView } from "@srctrek/core"
import { wrap } from "../ui/text"
import type { Tone } from "../ui/theme"
import { flagWords } from "./flags"
import type { Look } from "./peek"

/**
 * A line of a step's details: its text and look, and, for a line that leads somewhere, the step
 * enter goes to.
 */
export type DetailLine = Readonly<{
  text: string
  tone?: Tone
  bold?: boolean
  goes?: string
  // a cited line, which enter opens beside the trek
  opens?: Look
}>

/** A cited line's code, as the file has it now; empty where it can't be read. */
export type CodeAt = (path: string, line: number) => string

const blank: DetailLine = { text: "" }
const heading = (text: string): DetailLine => ({ text, tone: "dim" })

// `text` wrapped to `width`, each line indented `indent`, in one look.
function wrapped(text: string, width: number, indent: string, look: Omit<DetailLine, "text"> = {}) {
  return wrap(text, Math.max(10, width - indent.length)).map((line) => ({
    ...look,
    text: `${indent}${line}`,
  }))
}

// "line 15  order ≈ { … }   predicted", the value whole, wrapped, as the code's line shows it cut.
function valueLines(value: StepView["predicted_values"][number], width: number): DetailLine[] {
  const subject = value.role === "return" ? "returns" : value.name
  const doubt = value.uncertain === true
  const wording = doubt ? "predicted, unsure" : "predicted"
  const text = `line ${String(value.line)}  ${subject} ${doubt ? "≈?" : "≈"} ${value.value}   ${wording}`
  return wrapped(text, width, "  ", { tone: doubt ? "warn" : "dim" })
}

// How the step was reached, from which stop, then each line its evidence cites with that line's
// code under it; a link with no evidence of its own says it's guessed.
function cameFromLines(view: StepView, codeAt: CodeAt): DetailLine[] {
  const link = view.came_from
  if (link === null) {
    return []
  }

  const name = link.name === null ? "" : ` · ${link.name}`
  const guessed = link.guessed ? "   guessed: matched by name" : ""
  const cites = link.cites.flatMap((cite): DetailLine[] => [
    {
      text: `    ${cite.repo}: ${cite.file}:${String(cite.line)}`,
      tone: "dim",
      opens: {
        path: cite.path,
        line: cite.line,
        label: `evidence · ${cite.file}:${String(cite.line)}`,
      },
    },
    { text: `      ${codeAt(cite.path, cite.line)}` },
  ])

  return [
    blank,
    heading(link.label.toUpperCase()),
    {
      text: `  stop ${String(link.number)}${name}${guessed}`,
      ...(link.guessed ? { tone: "warn" as const } : {}),
      goes: link.id,
    },
    ...cites,
  ]
}

function flagLines(view: StepView, width: number): DetailLine[] {
  const flag = view.flag ?? undefined
  if (flag === undefined) {
    return []
  }

  const tone: Tone = flag.severity === "high" ? "bad" : "warn"
  const note = wrap(`${flagWords(flag.severity)} · ${flag.note}`, width - 2)
  return [blank, heading("FLAG"), ...note.map((text) => ({ text: `  ${text}`, tone }))]
}

// Each piece of context by name and place, enter going there, its reason wrapped under it.
function contextLines(view: StepView, width: number): DetailLine[] {
  if (view.context.length === 0) {
    return []
  }

  const piece = (ref: StepView["context"][number]): DetailLine[] => [
    {
      text: `  ${ref.name ?? ref.file}   ${ref.repo}: ${ref.file}:${String(ref.start_line)}`,
      tone: "accent",
      goes: ref.id,
    },
    ...wrapped(ref.summary, width, "    ", { tone: "dim" }),
  ]
  return [blank, heading("CONTEXT"), ...view.context.flatMap(piece)]
}

function questionLines(view: StepView, width: number): DetailLine[] {
  if (view.notes.length === 0) {
    return []
  }

  const note = (each: StepView["notes"][number]): DetailLine[] => [
    blank,
    { text: `  Q: ${each.question}`, bold: true },
    ...wrap(each.answer, width - 4).map((text) => ({ text: `    ${text}` })),
  ]
  return [blank, heading("QUESTIONS"), ...view.notes.flatMap(note)]
}

/**
 * A step's details, `width` wide: its summary and details, how it was reached with the evidence,
 * its flag, its values whole, its context, and its questions.
 */
export function detailLines(view: StepView, width: number, codeAt: CodeAt): DetailLine[] {
  const values: DetailLine[] =
    view.predicted_values.length === 0
      ? []
      : [blank, heading("VALUES"), ...view.predicted_values.flatMap((v) => valueLines(v, width))]

  return [
    ...wrapped(view.summary, width, "", { bold: true }),
    blank,
    ...view.details
      .split("\n")
      .flatMap((paragraph) => wrap(paragraph, width).map((text) => ({ text }))),
    ...cameFromLines(view, codeAt),
    ...flagLines(view, width),
    ...values,
    ...contextLines(view, width),
    ...questionLines(view, width),
  ]
}
