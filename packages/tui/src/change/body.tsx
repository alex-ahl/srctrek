import {
  type ChangeSummary,
  type OverviewView,
  type ProposedRepo,
  type PullRequestDetails,
  type TrekStatus,
  buildProgress,
} from "@srctrek/core"
import type { BuildRead } from "../build-view/read"
import { useNow } from "../ui/clock"
import { SEPARATOR } from "../ui/separator"
import { count, shortAge } from "../ui/text"
import { useTones } from "../ui/theme"
import type { StateLabel } from "../ui/state-labels"
import { useStateText } from "../ui/turning"
import { useEffect, useState } from "react"
import { Building } from "./building"
import { ChangeHeading } from "./line"
import { TrekPreview } from "./preview"
import { type Opened, statusBlock } from "./status-block"

// What's said of a saved trek beside its state, dimmed: when it was built and how many stops it
// has, "built 2h ago  ¦  14 stops"; nothing for one not built yet.
function savedText(builtAt: string | undefined, overview: OverviewView | undefined, now: Date) {
  if (overview === undefined) {
    return ""
  }

  const built = builtAt === undefined ? [] : [`built ${shortAge(builtAt, now)}`]
  return [...built, count(overview.count, "stop")].map((part) => `${SEPARATOR}${part}`).join("")
}

// When the build that failed or was stopped ended, once read: "2d ago"; nothing before.
function useEndedAgo(
  status: TrekStatus,
  readBuild: (name: string) => Promise<BuildRead>,
  now: Date,
): string {
  const name = status.kind === "failed" ? status.name : undefined
  const [ended, setEnded] = useState<Readonly<{ name: string; at: Date | undefined }>>()
  useEffect(() => {
    if (name === undefined) {
      return undefined
    }

    let current = true
    void readBuild(name).then(
      (read) => current && setEnded({ name, at: read.ended }),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [name, readBuild])

  const at = ended?.name === name ? ended?.at : undefined
  return at === undefined ? "" : shortAge(at.toISOString(), now)
}

// Beside a failed build's state, when it ended: "  ¦  2h ago". A stopped build left no trek, and
// says when under it instead.
const failedText = (status: Readonly<{ logTail: readonly string[] }>, ago: string) =>
  buildProgress(status.logTail).stopped || ago === "" ? "" : `${SEPARATOR}${ago}`

// Where the trek stands: its symbol and state in the state's tone, when it was built and how many
// stops it has, then dim lines saying why; a trek whose work is done, how it ended.
function StateBlock(props: {
  status: TrekStatus
  done: string | undefined
  canBuild: boolean
  open: Opened
  saved: string
  // when its last build ended, "2d ago", once known
  ago: string
}) {
  const tones = useTones()
  const block =
    props.done === undefined
      ? statusBlock(props.status, props.canBuild, props.open, props.ago)
      : { ...doneBlock(props.done), details: [] }
  const text = useStateText(block)

  return (
    <box flexDirection="column">
      <text fg={tones[block.tone]}>
        {text}
        <span fg={tones.dim}>{props.saved}</span>
      </text>
      {block.details.map((line, i) => (
        <text key={i} fg={tones.dim}>{`  ${line}`}</text>
      ))}
    </box>
  )
}

const doneBlock = (why: string): StateLabel => ({ symbol: "✓", state: why, tone: "dim" })

// A repo the agent went into that the change doesn't hold, for the user to add or dismiss.
function Proposal({ proposal }: { proposal: ProposedRepo }) {
  const tones = useTones()
  return (
    <text fg={tones.accent}>
      {"? "}
      <span fg={tones.dim}>the agent went into </span>
      {proposal.name}
      <span fg={tones.dim}>{`   ${proposal.reason}`}</span>
    </text>
  )
}

// What's open, as the state words it: code as it is, from a trigger or not, else a change.
const openedOf = (summary: ChangeSummary | undefined): Opened => ({
  code: summary?.code ?? false,
  trigger: summary?.trigger,
})

/**
 * A change's screen under its title: the change and how big it is, where its trek stands, or the
 * build as it runs, a repo the agent proposed, and, once there's a trek, its overview.
 */
export function ChangeBody({
  summary,
  details,
  status,
  overview,
  proposal,
  done,
  readBuild,
  canBuild,
  builtAt,
  width,
}: {
  summary: ChangeSummary | undefined
  // a pull request's title, who opened it, and whether it's a draft, once known
  details: PullRequestDetails | undefined
  status: TrekStatus
  overview: OverviewView | undefined
  proposal: ProposedRepo | undefined
  // how a trek whose work is done ended, in a word
  done: string | undefined
  // the latest build of the trek by this name, as it stands
  readBuild: (name: string) => Promise<BuildRead>
  canBuild: boolean
  // when its trek was built, once it's saved
  builtAt?: string | undefined
  width: number
}) {
  const now = useNow()
  const ago = useEndedAgo(status, readBuild, now)
  return (
    <box flexDirection="column">
      {summary !== undefined && (
        <box flexDirection="column">
          <ChangeHeading summary={summary} details={details} width={width} />
          <text> </text>
        </box>
      )}
      {status.kind === "building" ? (
        <Building name={status.name} read={readBuild} width={width} />
      ) : (
        <StateBlock
          status={status}
          done={done}
          canBuild={canBuild}
          open={openedOf(summary)}
          saved={
            status.kind === "failed" ? failedText(status, ago) : savedText(builtAt, overview, now)
          }
          ago={ago}
        />
      )}
      {proposal !== undefined && (
        <box flexDirection="column">
          <text> </text>
          <Proposal proposal={proposal} />
        </box>
      )}
      {overview !== undefined && (
        <box flexDirection="column">
          <text> </text>
          <TrekPreview view={overview} width={width} />
        </box>
      )}
    </box>
  )
}
