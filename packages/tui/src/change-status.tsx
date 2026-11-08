import type { TrekStatus } from "@srctrek/core"

type Props = { status: TrekStatus; canBuild: boolean }

const MUTED = "#7a7f99"

function Line({ text, fg }: { text: string; fg?: string }) {
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

type Stale = Extract<TrekStatus, { kind: "stale" }>

// What changed since the trek was built, and how to bring it up to date.
function staleText({ name, staleSteps, steps }: Stale, canBuild: boolean): string {
  const changed =
    staleSteps === 0
      ? "it was built at older commits, though none of its steps' files changed"
      : `${staleSteps} of ${steps} steps cite files changed since it was built`
  const action = canBuild ? "  b: update it" : ""

  return `This change's trek ${name} is out of date: ${changed}.${action}`
}

/** One line on where the change's trek stands, above the list of treks. */
export function ChangeStatus({ status, canBuild }: Props) {
  const { name } = status

  if (status.kind === "ready") {
    return <Line text={`This change's trek: ${name}`} fg="#86efac" />
  }

  if (status.kind === "building") {
    return (
      <LogTail
        heading={`Building ${name}… your agent is on it; the trek appears when it's saved.`}
        lines={status.logTail}
      />
    )
  }

  if (status.kind === "failed") {
    return (
      <LogTail
        heading={`Building ${name} failed. The end of its log:`}
        lines={status.logTail}
        fg="#fca5a5"
      />
    )
  }

  if (status.kind === "stale") {
    return <Line text={staleText(status, canBuild)} fg="#fcd34d" />
  }

  if (status.kind === "triggers") {
    return (
      <Line text={`Found ${status.triggers.length} ways into this code. Pick one to trek it.`} />
    )
  }

  if (status.kind === "empty") {
    return (
      <Line
        text="This change has no commits, so there's nothing to trek. Give trek a range, such as trek HEAD~5..HEAD."
        fg={MUTED}
      />
    )
  }

  if (canBuild) {
    return <Line text={`No trek of this change yet.  b: build ${name}`} />
  }

  return (
    <Line
      text="No trek of this change yet. Set SRCTREK_AGENT to your agent's headless command, and trek builds one."
      fg={MUTED}
    />
  )
}
