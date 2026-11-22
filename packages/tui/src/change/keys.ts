import type { TrekStatus } from "@srctrek/core"
import type { KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup } from "../ui/keys-help"

/**
 * What a change's screen does besides showing the change: step its trek here or in an editor,
 * build it, read its builds, and go back.
 */
export type ChangeActions = Readonly<{
  step: () => void
  editor: Readonly<{ label: string; open: () => void }> | undefined
  // the settings choose the editor: enter opens it, and n steps here
  editorFirst: boolean
  // absent when no agent is set
  build: (() => void) | undefined
  builds: (() => void) | undefined
  back: () => void
}>

const STEPPABLE: ReadonlySet<TrekStatus["kind"]> = new Set(["ready", "older-guide", "stale"])

/** Whether the change's trek can be stepped: saved, even when built at older commits. */
export const canStep = (status: TrekStatus) => STEPPABLE.has(status.kind)

// What b does to the change's trek, in the states it can build from.
const BUILD_VERBS: Partial<Readonly<Record<TrekStatus["kind"], string>>> = {
  missing: "build",
  stale: "update",
  ready: "build again",
  "older-guide": "build again",
  unreadable: "build again",
  failed: "build again",
}

// Enter, and the other place one key away: e for the editor, or n for here.
function placeHints(status: TrekStatus, { editor, editorFirst }: ChangeActions): KeyHint[] {
  if (!canStep(status)) {
    return []
  }

  const here = status.kind === "stale" ? "step it as it is" : "step here"
  if (editor === undefined) {
    return [{ key: "enter", does: here }]
  }

  return editorFirst
    ? [
        { key: "enter", does: editor.label },
        { key: "n", does: here },
      ]
    : [
        { key: "enter", does: here },
        { key: "e", does: editor.label },
      ]
}

// What acts on the trek besides stepping it.
function trekHints(status: TrekStatus, actions: ChangeActions): KeyHint[] {
  const verb = BUILD_VERBS[status.kind]
  return [
    ...(verb === undefined || actions.build === undefined ? [] : [{ key: "b", does: verb }]),
    ...(actions.builds === undefined ? [] : [{ key: "l", does: "builds" }]),
  ]
}

/** The footer: where enter steps the trek and the other place, then what acts on it. */
export function changeHints(status: TrekStatus, actions: ChangeActions): KeyHint[] {
  return [...placeHints(status, actions), ...trekHints(status, actions), HELP_HINT]
}

/** Every key on the screen, for the panel ? opens. */
export function changeGroups(status: TrekStatus, actions: ChangeActions): KeyGroup[] {
  return [
    { title: "this change", keys: [...placeHints(status, actions), ...trekHints(status, actions)] },
    { title: "leave", keys: [{ key: "esc", does: "back" }] },
  ]
}

/** What the screen's keys do, each only where its hint is offered. */
export function changeKeys(
  status: TrekStatus,
  actions: ChangeActions,
): ReadonlyMap<string, () => void> {
  const { editor, editorFirst, step } = actions
  const stepping = canStep(status)
  const enter = editorFirst && editor !== undefined ? editor.open : step
  const builds = BUILD_VERBS[status.kind] !== undefined

  return new Map([
    ["return", () => stepping && enter()],
    ["e", () => stepping && editor?.open()],
    ["n", () => stepping && editorFirst && step()],
    ["b", () => builds && actions.build?.()],
    ["l", () => actions.builds?.()],
    ["escape", actions.back],
    ["q", actions.back],
  ])
}
