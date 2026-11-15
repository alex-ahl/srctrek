import type { ProposedRepo, TrekEntry, TrekStatus } from "@srctrek/core"
import { buildVerb, enterLabel, footerKeys } from "./footer-keys"
import { type Item } from "./list/lines"
import { type Row } from "./list/rows"
import { canStartBuild, hasLog, hasTrek } from "./states"
import type { Props } from "./app"

export type Action = (() => void) | undefined

// Enter on a proposed repo adds it, or first asks where it lives when the agent didn't say.
export function addAction(
  proposal: ProposedRepo,
  props: Props,
  askLocation: (name: string) => void,
) {
  const { onAddRepo } = props
  if (onAddRepo === undefined) {
    return undefined
  }

  const { name, source } = proposal
  return source === undefined ? () => askLocation(name) : () => onAddRepo(name)
}

// A trek opens unless it isn't valid, or it's the change's trek and names a repo not here.
export function opens(entry: TrekEntry, status: TrekStatus | undefined): boolean {
  const unreachable = status?.kind === "unreachable" && status.name === entry.name

  return entry.valid && !unreachable
}

// What enter does on a row: add a proposed repo; open a trek; on a trigger, open its trek or
// build it.
export function pickAction(row: Row, props: Props, askLocation: (name: string) => void): Action {
  const { entries, onOpen, onBuildTrigger } = props
  if (row.kind === "proposal") {
    return addAction(row.proposal, props, askLocation)
  }

  if (row.kind === "trek") {
    return opens(row.entry, props.status) ? () => onOpen(row.entry) : undefined
  }

  const { trigger, trek } = row.found
  if (hasTrek(trek)) {
    const entry = entries.find((e) => e.name === trek.name)
    return entry?.valid ? () => onOpen(entry) : undefined
  }

  return canStartBuild(trek) && onBuildTrigger ? () => onBuildTrigger(trigger.name) : undefined
}

// Whose build log l shows: the selected trigger's, when it has one, else the change's.
export function logName(row: Row | undefined, status: TrekStatus | undefined): string | undefined {
  if (row?.kind === "trigger" && hasLog(row.found.trek)) {
    return row.found.trek.name
  }

  return hasLog(status) ? status.name : undefined
}

// What each key does on the selected row; undefined where it does nothing.
export type RowActions = { pick: Action; build: Action; showLog: Action; dismiss: Action }

export function dismissAction(row: Row | undefined, onDismissRepo: Props["onDismissRepo"]): Action {
  if (row?.kind !== "proposal" || onDismissRepo === undefined) {
    return undefined
  }

  const { name } = row.proposal
  return () => onDismissRepo(name)
}

export function actionsFor(
  row: Row | undefined,
  props: Props,
  askLocation: (name: string) => void,
): RowActions {
  const { status, onBuild, onShowLog } = props
  const log = logName(row, status)

  return {
    pick: row === undefined ? undefined : pickAction(row, props, askLocation),
    build: canStartBuild(status) ? onBuild : undefined,
    showLog: log !== undefined && onShowLog ? () => onShowLog(log) : undefined,
    dismiss: dismissAction(row, props.onDismissRepo),
  }
}

// What enter, b, l, d, and C do here, for the footer; only keys that do something are listed.
export function keyHints(
  item: Item | undefined,
  status: TrekStatus | undefined,
  actions: RowActions,
  props: Props,
) {
  const { editor } = props
  const row = item?.kind === "row" ? item.row : undefined
  const enter = item?.kind === "fold" ? (item.open ? "hide" : "show") : enterLabel(row, editor)

  return footerKeys(actions.pick === undefined ? undefined : enter, {
    build: actions.build === undefined ? undefined : buildVerb(status),
    log: actions.showLog !== undefined,
    dismiss: actions.dismiss !== undefined,
    change: props.choosing !== undefined,
  })
}
