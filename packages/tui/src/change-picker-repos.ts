import type { NearbyCheckout, RepoPick } from "@srctrek/core"
import { count } from "./text"

/** The repos ticked to go with the change, by path. */
export type Ticked = ReadonlyMap<string, RepoPick>

/** A repo beside this one in the picker's list, ticked or not. */
export type RepoItem = Readonly<{
  kind: "repo"
  checkout: NearbyCheckout
  pick: RepoPick | undefined
}>

/** The repos with nothing to show folded under a count, until opened. */
export type FoldItem = Readonly<{ kind: "fold"; count: number }>

/** The ticks a choice already carries. */
export function tickedOf(repos: readonly RepoPick[] | undefined): Ticked {
  return new Map((repos ?? []).map((repo) => [repo.path, repo]))
}

// Work on it, or ticked: worth listing without opening the fold.
const shows = (checkout: NearbyCheckout, ticked: Ticked) =>
  checkout.commits > 0 || ticked.has(checkout.path)

/**
 * The repos to list under MORE REPOS: those with work on them and those ticked, then the rest,
 * folded under a count until `open`.
 */
export function repoItems(
  checkouts: readonly NearbyCheckout[],
  ticked: Ticked,
  open: boolean,
): Array<RepoItem | FoldItem> {
  const item = (checkout: NearbyCheckout): RepoItem => ({
    kind: "repo",
    checkout,
    pick: ticked.get(checkout.path),
  })
  const listed = checkouts.filter((checkout) => shows(checkout, ticked)).map(item)
  const rest = checkouts.filter((checkout) => !shows(checkout, ticked)).map(item)
  if (rest.length === 0) {
    return listed
  }

  return open ? [...listed, ...rest] : [...listed, { kind: "fold", count: rest.length }]
}

/** The ticks with `checkout` ticked, as changed when it has work on it, or unticked. */
export function toggled(ticked: Ticked, checkout: NearbyCheckout): Ticked {
  const next = new Map(ticked)
  if (next.has(checkout.path)) {
    next.delete(checkout.path)
  } else {
    next.set(checkout.path, { path: checkout.path, changed: checkout.commits > 0 })
  }

  return next
}

/** "on refunds-api · 4 commits", "on main · passed through": what a repo row says after its path. */
export function repoDetail({ checkout, pick }: RepoItem): string {
  const on = `on ${checkout.branch ?? "a detached commit"}`
  if (pick !== undefined && !pick.changed) {
    return `${on} · passed through`
  }

  return checkout.commits > 0 ? `${on} · ${count(checkout.commits, "commit")}` : on
}

const names = (items: readonly string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`

/**
 * What picking opens, the change with the ticked repos: "feature/refunds · 3 commits since main,
 * refunds-api in api · worker passed through".
 */
export function opensWith(
  change: string,
  ticked: Ticked,
  checkouts: readonly NearbyCheckout[],
): string {
  const picked = checkouts.filter((checkout) => ticked.has(checkout.path))
  const changed = picked
    .filter((checkout) => ticked.get(checkout.path)?.changed === true)
    .map((checkout) => `${checkout.branch ?? "HEAD"} in ${checkout.name}`)
  const passed = picked
    .filter((checkout) => ticked.get(checkout.path)?.changed === false)
    .map((checkout) => checkout.name)

  const withChanged = [change, ...changed].join(", ")
  return passed.length === 0 ? withChanged : `${withChanged} · ${names(passed)} passed through`
}
