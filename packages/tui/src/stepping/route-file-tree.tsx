import { type RGBA, TextAttributes } from "@opentui/core"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { FLAGS } from "./flags"
import type { RouteStop } from "./route"
import type { TrekFile } from "./route-files"
import { type Where, windowOf } from "./route-tree"

/** A line of the file tree: a repo, a folder, or a file. */
type FileLine =
  | Readonly<{ kind: "repo"; text: string }>
  | Readonly<{ kind: "dir"; text: string }>
  | Readonly<{ kind: "file"; file: TrekFile }>

// A repo's name over its folders, a folder on one line over its files; a gap between repos.
function linesOf(files: readonly TrekFile[]): FileLine[] {
  return files.flatMap((file, i): FileLine[] => {
    const before = files[i - 1]
    const repo = before?.repo !== file.repo
    const dir = repo || before.dir !== file.dir
    return [
      ...(repo && i > 0 ? [{ kind: "repo" as const, text: "" }] : []),
      ...(repo ? [{ kind: "repo" as const, text: file.repo }] : []),
      ...(dir ? [{ kind: "dir" as const, text: file.dir === "" ? "/" : file.dir }] : []),
      { kind: "file" as const, file },
    ]
  })
}

// The file's stops by number: ▶'s lit, n's in the accent, those stepped to dimmed.
function StopNumbers({
  route,
  file,
  where,
}: {
  route: readonly RouteStop[]
  file: TrekFile
  where: Where
}) {
  const tones = useTones()
  const toneOf = (index: number) => {
    const stop = route[index]
    if (index === where.here || stop?.id === where.next) {
      return tones.accent
    }

    return stop?.visited === true ? tones.dim : COLOUR.text
  }

  return (
    <>
      {file.stops.map((index) => (
        <span
          key={index}
          fg={toneOf(index)}
          {...(index === where.here ? { attributes: TextAttributes.BOLD } : {})}
        >
          {` ${String(route[index]?.number ?? "").padStart(2)}`}
        </span>
      ))}
    </>
  )
}

function FileRow({
  route,
  file,
  where,
  chosen,
  width,
  tint,
}: {
  route: readonly RouteStop[]
  file: TrekFile
  where: Where
  chosen: boolean
  width: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const here = file.stops.includes(where.here)
  const next = file.stops.some((index) => route[index]?.id === where.next)
  const mark = here ? "▶ " : next ? "n " : "  "
  const stops = file.stops.map((index) => route[index])
  const flag = stops.find((stop) => stop?.flag !== undefined)?.flag
  const changed = stops.some((stop) => stop?.changed === true)
  const room = width - 2 - 6 - file.stops.length * 3 - 4

  return (
    <box
      style={{ flexShrink: 0, ...(chosen && tint !== undefined ? { backgroundColor: tint } : {}) }}
    >
      <text fg={COLOUR.text}>
        <span fg={tones.accent} attributes={TextAttributes.BOLD}>
          {mark}
        </span>
        {"      "}
        <span {...(here ? { attributes: TextAttributes.BOLD } : {})}>
          {fit(file.name, Math.max(4, room)).padEnd(Math.max(4, room))}
        </span>
        <StopNumbers route={route} file={file} where={where} />
        <span fg={tones.good}>{changed ? " +" : "  "}</span>
        <span fg={flag === undefined ? tones.dim : tones[FLAGS[flag.severity].tone]}>
          {` ${flag === undefined ? " " : FLAGS[flag.severity].mark}`}
        </span>
      </text>
    </box>
  )
}

/**
 * The trek's files as a tree: each repo, its folders each on one line, each file with its stops;
 * ▶ on the file the trek is in, n on the one it goes to next.
 */
export function FileTree({
  route,
  files,
  chosen,
  where,
  width,
  height,
  tint,
}: {
  route: readonly RouteStop[]
  files: readonly TrekFile[]
  chosen: number
  where: Where
  width: number
  height: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const lines = linesOf(files)
  const at = lines.findIndex((line) => line.kind === "file" && line.file.stops.includes(chosen))
  const { first, last } = windowOf(lines.length, Math.max(0, at), height)

  return (
    <box flexDirection="column" style={{ width, flexShrink: 0 }}>
      {lines.slice(first, last).map((line, i) =>
        line.kind === "file" ? (
          <FileRow
            key={first + i}
            route={route}
            file={line.file}
            where={where}
            chosen={first + i === at}
            width={width}
            tint={tint}
          />
        ) : (
          <text
            key={first + i}
            fg={line.kind === "repo" ? COLOUR.text : tones.dim}
            {...(line.kind === "repo" ? { attributes: TextAttributes.BOLD } : {})}
          >
            {fit(`${line.kind === "repo" ? "  " : "    "}${line.text}`, width)}
          </text>
        ),
      )}
    </box>
  )
}
