import type { TrekStatus } from "@srctrek/core"

type Props = { status: TrekStatus; canBuild: boolean }

const MUTED = "#7a7f99"
const GOOD = "#86efac"
const WARN = "#fcd34d"
const BAD = "#fca5a5"

function Line({ text, fg }: { text: string; fg?: string | undefined }) {
  return <text {...(fg === undefined ? {} : { fg })}>{text}</text>
}

// A heading, then the end of the build's log, dimmed.
function LogTail({ heading, lines, fg }: { heading: string; lines: string[]; fg?: string }) {
  return (
    <box flexDirection="column">
      <Line text={heading} {...(fg === undefined ? {} : { fg })} />
      {lines.map((line, i) => (
        <Line key={i} text={`  ${line}`} fg={MUTED} />
      ))}
    </box>
  )
}

type WithLog = Extract<TrekStatus, { kind: "building" | "failed" }>
type OneLine = Exclude<TrekStatus, WithLog>
type Stale = Extract<TrekStatus, { kind: "stale" }>
type Described = { text: string; fg?: string }

// What b offers, said only when there's an agent to do it.
function offer(canBuild: boolean, action: string): string {
  return canBuild ? `  b: ${action}` : ""
}

// What changed since the trek was built, and how to bring it up to date.
function staleLine({ name, staleSteps, steps }: Stale, canBuild: boolean): Described {
  const changed =
    staleSteps === 0
      ? "it was built at older commits, though none of its steps' files changed"
      : `${staleSteps} of ${steps} steps cite files changed since it was built`

  return {
    text: `This change's trek ${name} is out of date: ${changed}.${offer(canBuild, "update it")}`,
    fg: WARN,
  }
}

function missingLine(name: string, canBuild: boolean): Described {
  if (canBuild) {
    return { text: `No trek of this change yet.  b: build ${name}` }
  }

  return {
    text: "No trek of this change yet. Set SRCTREK_AGENT to your agent's headless command, and trek builds one.",
    fg: MUTED,
  }
}

// Where the trek stands, in one line, for every state but a build's.
function describe(status: OneLine, canBuild: boolean): Described {
  const { name } = status

  if (status.kind === "ready") {
    return { text: `This change's trek: ${name}`, fg: GOOD }
  }

  if (status.kind === "older-guide") {
    const text = `This change's trek ${name} was built with an older guide than today's.`
    return { text: text + offer(canBuild, "rebuild it"), fg: WARN }
  }

  if (status.kind === "stale") {
    return staleLine(status, canBuild)
  }

  if (status.kind === "unreadable") {
    const text = `This change's trek ${name} can't be read: ${status.problem}.`
    return { text: text + offer(canBuild, "rebuild it"), fg: BAD }
  }

  if (status.kind === "triggers") {
    return { text: `Found ${status.triggers.length} ways into this code. Pick one to trek it.` }
  }

  if (status.kind === "empty") {
    return {
      text: "This change has no commits, so there's nothing to trek. Give trek a range, such as trek HEAD~5..HEAD.",
      fg: MUTED,
    }
  }

  return missingLine(name, canBuild)
}

function hasLog(status: TrekStatus): status is WithLog {
  return status.kind === "building" || status.kind === "failed"
}

/** One line on where the change's trek stands, above the list of treks. */
export function ChangeStatus({ status, canBuild }: Props) {
  if (!hasLog(status)) {
    const { text, fg } = describe(status, canBuild)
    return <Line text={text} fg={fg} />
  }

  const { name } = status
  if (status.kind === "building") {
    return (
      <LogTail
        heading={`Building ${name}… your agent is on it; the trek appears when it's saved.`}
        lines={status.logTail}
      />
    )
  }

  return (
    <LogTail
      heading={`Building ${name} failed. The end of its log:`}
      lines={status.logTail}
      fg={BAD}
    />
  )
}
