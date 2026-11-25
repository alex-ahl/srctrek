import type { ProposedRepo, TrekStatus } from "@srctrek/core"
import type { KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup } from "../ui/keys-help"

/**
 * What a change's screen does besides showing the change: step its trek here or in an editor,
 * build it or stop the build, read its builds, settle a repo the agent proposed, and go back.
 * What starts work settles once it's started, and the screen then reads where things stand.
 */
export type ChangeActions = Readonly<{
  // each takes the name of the trek, as it stands when the key is pressed
  step: (name: string) => void
  editor: Readonly<{ label: string; open: (name: string) => void }> | undefined
  // the settings choose the editor: enter opens it, and n steps here
  editorFirst: boolean
  // absent when no agent is set
  build: (() => Promise<void>) | undefined
  stop: (name: string) => Promise<void>
  builds: ((name: string) => void) | undefined
  // adds a proposed repo at `location`, or where the agent found it
  addRepo: (name: string, location?: string) => Promise<void>
  dismissRepo: (name: string) => Promise<void>
  back: () => void
}>

/** A question the screen asks in the footer's place, and what the answer does. */
export type Ask = Readonly<{ question: string; hint?: string; answer: (text: string) => void }>

/** What the keys need besides the actions: the repo proposed, and how to run and ask. */
export type KeyContext = Readonly<{
  status: TrekStatus
  // code as it is with no trigger: b finds its ways in rather than building a trek
  findsWaysIn: boolean
  // the first repo the agent proposed that's still unsettled
  proposal: ProposedRepo | undefined
  run: (work: Promise<void>) => void
  ask: (ask: Ask) => void
  // beside the landing page's list, enter builds a change with no trek to step
  enterBuilds?: boolean | undefined
}>

const STEPPABLE: ReadonlySet<TrekStatus["kind"]> = new Set(["ready", "older-guide", "stale"])

// No trek yet, or nothing to trek: no build to look at.
const UNBUILT: ReadonlySet<TrekStatus["kind"]> = new Set(["missing", "empty"])

const offersBuilds = (status: TrekStatus, actions: ChangeActions) =>
  actions.builds !== undefined && !UNBUILT.has(status.kind)

/** Whether the change's trek can be stepped: saved, even when built at older commits. */
export const canStep = (status: TrekStatus) => STEPPABLE.has(status.kind)

/** What b does to a trek, in the states it can build from. */
export const BUILD_VERBS: Partial<Readonly<Record<TrekStatus["kind"], string>>> = {
  missing: "build",
  stale: "update",
  ready: "build again",
  "older-guide": "build again",
  unreadable: "build again",
  failed: "build again",
}

// What b does for code as it is with no trigger, whose ways in are found rather than a trek built.
const FIND_VERBS: Partial<Readonly<Record<TrekStatus["kind"], string>>> = {
  missing: "find ways in",
  failed: "find them again",
}

const verbOf = ({ status, findsWaysIn }: KeyContext) =>
  (findsWaysIn ? FIND_VERBS : BUILD_VERBS)[status.kind]

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

// The key that builds: enter where it builds a trek there's none of to step, else b.
const buildKey = ({ status, enterBuilds }: KeyContext) =>
  enterBuilds === true && !canStep(status) ? "enter" : "b"

// What acts on the trek besides stepping it, and on a repo the agent proposed.
function trekHints(context: KeyContext, actions: ChangeActions): KeyHint[] {
  const verb = verbOf(context)
  const { proposal } = context
  return [
    ...(verb === undefined || actions.build === undefined
      ? []
      : [{ key: buildKey(context), does: verb }]),
    ...(proposal === undefined ? [] : [{ key: "y", does: `add ${proposal.name}` }]),
    ...xHint(context),
    ...(offersBuilds(context.status, actions) ? [{ key: "l", does: "builds" }] : []),
  ]
}

/** The footer: where enter steps the trek and the other place, then what acts on it. */
export function changeHints(context: KeyContext, actions: ChangeActions): KeyHint[] {
  return [...placeHints(context.status, actions), ...trekHints(context, actions), HELP_HINT]
}

/** The keys that act on the change, for the panel ? opens. */
export function changeGroup(context: KeyContext, actions: ChangeActions): KeyGroup {
  return {
    title: "this change",
    keys: [...placeHints(context.status, actions), ...trekHints(context, actions)],
  }
}

/** How a change's own screen is left, for the panel ? opens. */
export const LEAVE_GROUP: KeyGroup = { title: "leave", keys: [{ key: "esc", does: "back" }] }

// y adds the repo proposed, first asking where it lives when the agent didn't find out.
function addKey({ proposal, run, ask }: KeyContext, actions: ChangeActions) {
  if (proposal === undefined) {
    return
  }

  const { name, source } = proposal
  if (source === undefined) {
    const question = `Where does ${name} live? A path or URL, esc to cancel:`
    ask({ question, answer: (location) => run(actions.addRepo(name, location)) })
    return
  }

  run(actions.addRepo(name))
}

// x dismisses the repo proposed, else stops the build.
function xKey({ status, proposal, run }: KeyContext, actions: ChangeActions) {
  if (proposal !== undefined) {
    run(actions.dismissRepo(proposal.name))
    return
  }

  if (status.kind === "building") {
    run(actions.stop(status.name))
  }
}

/** What the screen's keys do, each only where its hint is offered. */
export function changeKeys(
  context: KeyContext,
  actions: ChangeActions,
): ReadonlyMap<string, () => void> {
  const { editor, editorFirst, step, build } = actions
  const { name } = context.status
  const stepping = canStep(context.status)
  const enter = editorFirst && editor !== undefined ? editor.open : step
  const builds = verbOf(context) !== undefined
  const buildNow = () => builds && build !== undefined && context.run(build())

  return new Map([
    ["return", () => (stepping ? enter(name) : context.enterBuilds === true && buildNow())],
    ["e", () => stepping && editor?.open(name)],
    ["n", () => stepping && editorFirst && step(name)],
    ["b", buildNow],
    ["y", () => addKey(context, actions)],
    ["x", () => xKey(context, actions)],
    ["l", () => offersBuilds(context.status, actions) && actions.builds?.(name)],
    ["escape", actions.back],
    ["q", actions.back],
  ])
}
