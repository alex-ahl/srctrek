import type { ProposedRepo, TrekEntry, TrekStatus } from "@srctrek/core"
import { buildVerb, enterLabel, footerKeys } from "./footer-keys"
import { type Item } from "./list/lines"
import { type Row } from "./list/rows"
import { canStartBuild, hasLog, hasTrek } from "./states"
import type { Props } from "./screen"

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
export function pickAction(
  row: Row,
  props: Props,
  askLocation: (name: string) => void,
  onOpen: (entry: TrekEntry) => void,
): Action {
  const { entries, onBuildTrigger } = props
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

// A way in's row whose trek is built: b builds it again, from the start, with the guide as it is.
const rebuildsTrigger = (row: Row | undefined): row is Extract<Row, { kind: "trigger" }> =>
  row?.kind === "trigger" && hasTrek(row.found.trek)

// What b does here: rebuild the selected way in's trek, else build the change's when it can.
function buildAction(row: Row | undefined, props: Props): Action {
  const { status, onBuild, onBuildTrigger } = props
  if (rebuildsTrigger(row) && onBuildTrigger) {
    const { trigger } = row.found
    return () => onBuildTrigger(trigger.name)
  }

  return canStartBuild(status) ? onBuild : undefined
}

// Whose builds l shows: the selected trek's or trigger's, else the change's while one runs or
// after it failed.
export function logName(row: Row | undefined, status: TrekStatus | undefined): string | undefined {
  if (row?.kind === "trek") {
    return row.entry.name
  }

  if (row?.kind === "trigger" && hasLog(row.found.trek)) {
    return row.found.trek.name
  }

  return hasLog(status) ? status.name : undefined
}

// Which build x stops: the selected trigger's, while it runs, else the change's.
export function buildingName(
  row: Row | undefined,
  status: TrekStatus | undefined,
): string | undefined {
  if (row?.kind === "trigger" && row.found.trek.kind === "building") {
    return row.found.trek.name
  }

  return status?.kind === "building" ? status.name : undefined
}

// What each key does on the selected row; undefined where it does nothing.
export type RowActions = {
  pick: Action
  build: Action
  showLog: Action
  stop: Action
  dismiss: Action
}

/** The screens a row's keys open over the list: a trek's builds, and a trek's page. */
export type Opens = Readonly<{ build: (name: string) => void; trek: (name: string) => void }>

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
  screens: Opens,
): RowActions {
  const { status, onReadBuild, onStopBuild } = props
  const log = logName(row, status)
  const building = buildingName(row, status)

  return {
    pick:
      row === undefined
        ? undefined
        : pickAction(row, props, askLocation, (entry) => screens.trek(entry.name)),
    build: buildAction(row, props),
    showLog: log !== undefined && onReadBuild ? () => screens.build(log) : undefined,
    stop: building !== undefined && onStopBuild ? () => onStopBuild(building) : undefined,
    dismiss: dismissAction(row, props.onDismissRepo),
  }
}

// Whether the block's own keys line names `key`, "b" in "b build it", so the footer needn't.
const names = (blockKeys: string | undefined, key: string) =>
  blockKeys?.split(" · ").some((hint) => hint.startsWith(`${key} `)) === true

// A key the footer lists: one that acts here, and that the block doesn't already name.
const offers = (action: Action, blockKeys: string | undefined, key: string) =>
  action !== undefined && !names(blockKeys, key)

// What b says it does: rebuild a way in's trek, else what it does to the change's.
const bVerb = (row: Row | undefined, status: TrekStatus | undefined) =>
  rebuildsTrigger(row) ? "rebuild" : buildVerb(status)

/**
 * What enter, b, x, and l do here, for the footer; only keys that do something are listed,
 * and b, x, and l only when the block above doesn't already say what they do.
 */
export function keyHints(
  item: Item | undefined,
  status: TrekStatus | undefined,
  actions: RowActions,
  blockKeys?: string,
) {
  const row = item?.kind === "row" ? item.row : undefined
  const enter = item?.kind === "fold" ? (item.open ? "hide" : "show") : enterLabel(row)

  return footerKeys(actions.pick === undefined ? undefined : enter, {
    build: offers(actions.build, blockKeys, "b") ? bVerb(row, status) : undefined,
    log: offers(actions.showLog, blockKeys, "l"),
    stop: offers(actions.stop, blockKeys, "x"),
    dismiss: actions.dismiss !== undefined,
  })
}
