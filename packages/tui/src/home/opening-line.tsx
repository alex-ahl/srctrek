import { type ChangeChoice, GitError, errorText, parsePullRequestUrl } from "@srctrek/core"
import { useTones } from "../ui/theme"

/** A picked change on its way: still being worked out, or why it couldn't be. */
export type Opening = Readonly<
  { kind: "opening"; choice: ChangeChoice } | { kind: "failed"; choice: ChangeChoice; why: string }
>

/**
 * Why a pick failed, in a line: what git itself said last ("could not read Username for
 * 'https://github.com'"), not the command it ran, which names cache paths no one needs.
 */
export function failureReason(error: unknown): string {
  if (!(error instanceof GitError)) {
    return errorText(error)
  }

  const said = error.stderr.trim().split("\n").at(-1) ?? ""
  return said.replace(/^fatal: /, "") || error.message
}

/** A choice in a few words: "your branch", "fix/rounding", "pr 12". */
export function choiceName(choice: ChangeChoice): string {
  if (choice.kind === "own") {
    return choice.uncommitted ? "your branch with uncommitted work" : "your branch"
  }

  if (choice.kind === "branch") {
    return choice.name
  }

  if (choice.kind === "given") {
    return choice.args.join(" ")
  }

  const number = parsePullRequestUrl(choice.url)?.number
  return number === undefined ? choice.url : `pr ${number}`
}

/** The line above the change's trek while a pick opens, or after it failed; nothing otherwise. */
export function OpeningLine({ opening }: { opening: Opening | undefined }) {
  const tones = useTones()
  if (opening === undefined) {
    return null
  }

  const name = choiceName(opening.choice)
  const line =
    opening.kind === "opening" ? (
      <text fg={tones.busy}>{`◐ opening ${name}…`}</text>
    ) : (
      <text fg={tones.bad}>{`✕ couldn't open ${name}: ${opening.why}`}</text>
    )

  return <box style={{ marginBottom: 1, flexShrink: 0 }}>{line}</box>
}
