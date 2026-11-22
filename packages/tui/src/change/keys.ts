import type { ProposedRepo, TrekStatus } from "@srctrek/core"
import type { KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup } from "../ui/keys-help"

/**
 * What a change's screen does besides showing the change: step its trek here or in an editor,
 * build it or stop the build, read its builds, settle a repo the agent proposed, and go back.
 * What starts work settles once it's started, and the screen then reads where things stand.
 */
export type ChangeActions = Readonly<{
  step: () => void
  editor: Readonly<{ label: string; open: () => void }> | undefined
  // the settings choose the editor: enter opens it, and n steps here
  editorFirst: boolean
  // absent when no agent is set
  build: (() => Promise<void>) | undefined
  stop: () => Promise<void>
  builds: (() => void) | undefined
  // adds a proposed repo at `location`, or where the agent found it
  addRepo: (name: string, location?: string) => Promise<void>
  dismissRepo: (name: string) => Promise<void>
  back: () => void
}>

/** What the keys need besides the actions: the repo proposed, and how to run and ask. */
export type KeyContext = Readonly<{
  status: TrekStatus
  // the first repo the agent proposed that's still unsettled
  proposal: ProposedRepo | undefined
  run: (work: Promise<void>) => void
  // asks where a proposed repo lives, when the agent didn't find out
  askLocation: (name: string) => void
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

// What x does: dismiss the repo proposed, else stop the build.
function xHint({ status, proposal }: KeyContext): KeyHint[] {
  if (proposal !== undefined) {
    return [{ key: "x", does: "dismiss" }]
  }

  return status.kind === "building" ? [{ key: "x", does: "stop" }] : []
}

// What acts on the trek besides stepping it, and on a repo the agent proposed.
function trekHints(context: KeyContext, actions: ChangeActions): KeyHint[] {
  const verb = BUILD_VERBS[context.status.kind]
  const { proposal } = context
  return [
    ...(verb === undefined || actions.build === undefined ? [] : [{ key: "b", does: verb }]),
    ...(proposal === undefined ? [] : [{ key: "a", does: `add ${proposal.name}` }]),
    ...xHint(context),
    ...(actions.builds === undefined ? [] : [{ key: "l", does: "builds" }]),
  ]
}

/** The footer: where enter steps the trek and the other place, then what acts on it. */
export function changeHints(context: KeyContext, actions: ChangeActions): KeyHint[] {
  return [...placeHints(context.status, actions), ...trekHints(context, actions), HELP_HINT]
}

/** Every key on the screen, for the panel ? opens. */
export function changeGroups(context: KeyContext, actions: ChangeActions): KeyGroup[] {
  const keys = [...placeHints(context.status, actions), ...trekHints(context, actions)]
  return [
    { title: "this change", keys },
    { title: "leave", keys: [{ key: "esc", does: "back" }] },
  ]
}

// a adds the repo proposed, first asking where it lives when the agent didn't find out.
function addKey({ proposal, run, askLocation }: KeyContext, actions: ChangeActions) {
  if (proposal === undefined) {
    return
  }

  if (proposal.source === undefined) {
    askLocation(proposal.name)
    return
  }

  run(actions.addRepo(proposal.name))
}

// x dismisses the repo proposed, else stops the build.
function xKey({ status, proposal, run }: KeyContext, actions: ChangeActions) {
  if (proposal !== undefined) {
    run(actions.dismissRepo(proposal.name))
    return
  }

  if (status.kind === "building") {
    run(actions.stop())
  }
}

/** What the screen's keys do, each only where its hint is offered. */
export function changeKeys(
  context: KeyContext,
  actions: ChangeActions,
): ReadonlyMap<string, () => void> {
  const { editor, editorFirst, step, build } = actions
  const stepping = canStep(context.status)
  const enter = editorFirst && editor !== undefined ? editor.open : step
  const builds = BUILD_VERBS[context.status.kind] !== undefined

  return new Map([
    ["return", () => stepping && enter()],
    ["e", () => stepping && editor?.open()],
    ["n", () => stepping && editorFirst && step()],
    ["b", () => builds && build !== undefined && context.run(build())],
    ["a", () => addKey(context, actions)],
    ["x", () => xKey(context, actions)],
    ["l", () => actions.builds?.()],
    ["escape", actions.back],
    ["q", actions.back],
  ])
}
