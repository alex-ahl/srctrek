import { type ChangeChoice, GitError, errorText, parsePullRequestUrl } from "@srctrek/core"
import { useKeyboard } from "@opentui/react"
import { Footer } from "./ui/footer"
import { PADDING } from "./ui/layout"
import { useTones } from "./ui/theme"
import { TitleBar } from "./ui/title-bar"

/** A picked change on its way: still being worked out, or why it couldn't be. */
export type Pending = Readonly<
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

/** A choice in a few words: "your branch", "fix/rounding", "pr 12", "code as it is". */
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

  if (choice.kind === "code") {
    return choice.trigger === undefined ? "code as it is" : `code from "${choice.trigger}"`
  }

  const number = parsePullRequestUrl(choice.url)?.number
  return number === undefined ? choice.url : `pr ${number}`
}

/**
 * A picked change on its way, on a screen of its own: still being worked out, or why it couldn't
 * be, with esc to go back.
 */
export function PendingScreen({ pending, onBack }: { pending: Pending; onBack: () => void }) {
  const tones = useTones()
  useKeyboard((key) => (key.name === "escape" || key.name === "q") && onBack())

  const name = choiceName(pending.choice)
  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <TitleBar />
      <box style={{ flexGrow: 1, paddingTop: 1, paddingLeft: PADDING, paddingRight: PADDING }}>
        {pending.kind === "opening" ? (
          <text fg={tones.busy}>{`◐ opening ${name}…`}</text>
        ) : (
          <text fg={tones.bad}>{`✕ couldn't open ${name}: ${pending.why}`}</text>
        )}
      </box>
      <Footer keys={[{ key: "esc", does: "back" }]} />
    </box>
  )
}
