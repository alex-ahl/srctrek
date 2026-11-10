import type { AgentCheck } from "@srctrek/core"
import { useTones } from "./theme"

/**
 * The line under the help, about the agent: checking a typed command and what that found, the
 * setup request copied for the agent's chat (or the terminal not taking it, which leaves it to
 * select on screen), or the agent having saved its command.
 */
export type Notice = Readonly<
  | { kind: "checking" }
  | { kind: "checked"; check: AgentCheck }
  | { kind: "copied" | "uncopied" | "saved-by-agent" }
>

const CHECKING = "checking that the command starts and answers…"
const WORKS = "✓ the command starts and answers"
const COPIED = "✓ Copied. Send it in your agent's chat; its command shows up here once saved."
const SAVED = "✓ your agent saved its command; it starts and answers"
const UNCOPIED = "Your terminal didn't take the copy: select the text above to copy it."

/** The notice as one or two lines, in the tone of how it went. */
export function NoticeLine({ notice }: { notice: Notice }) {
  const tones = useTones()

  if (notice.kind === "checking") {
    return <text fg={tones.dim}>{CHECKING}</text>
  }

  if (notice.kind === "checked") {
    const { check } = notice
    return check.ok ? (
      <text fg={tones.good}>{WORKS}</text>
    ) : (
      <text fg={tones.bad}>{`✕ ${check.problem}`}</text>
    )
  }

  if (notice.kind === "uncopied") {
    return <text fg={tones.warn}>{UNCOPIED}</text>
  }

  return <text fg={tones.good}>{notice.kind === "copied" ? COPIED : SAVED}</text>
}
