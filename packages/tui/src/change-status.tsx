import type { TourStatus } from "@codetrail/core"

type Props = { status: TourStatus; canBuild: boolean }

const MUTED = "#7a7f99"

function Line({ text, fg }: { text: string; fg?: string }) {
  return <text {...(fg === undefined ? {} : { fg })}>{text}</text>
}

/** One line on where the change's tour stands, above the list of tours. */
export function ChangeStatus({ status, canBuild }: Props) {
  const { name } = status

  if (status.kind === "ready") {
    return <Line text={`This change's tour: ${name}`} fg="#86efac" />
  }

  if (status.kind === "building") {
    return (
      <Line text={`Building ${name}… your agent is on it; the tour appears when it's saved.`} />
    )
  }

  if (status.kind === "failed") {
    return (
      <box flexDirection="column">
        <Line text={`Building ${name} failed. The end of its log:`} fg="#fca5a5" />
        {status.logTail.map((line, i) => (
          <Line key={i} text={`  ${line}`} fg={MUTED} />
        ))}
      </box>
    )
  }

  if (status.kind === "empty") {
    return (
      <Line
        text="This change has no commits, so there's nothing to tour. Give trail a range, such as trail HEAD~5..HEAD."
        fg={MUTED}
      />
    )
  }

  if (canBuild) {
    return <Line text={`No tour of this change yet.  b: build ${name}`} />
  }

  return (
    <Line
      text="No tour of this change yet. Set CODETRAIL_AGENT to your agent's headless command, and trail builds one."
      fg={MUTED}
    />
  )
}
