import type { NearbyCheckout, RepoPick } from "@srctrek/core"
import { count } from "../ui/text"

/** The repos ticked to go with the change, by path. */
export type Ticked = ReadonlyMap<string, RepoPick>

/** A repo beside this one in the picker's list, ticked or not. */
export type RepoItem = Readonly<{
  kind: "repo"
  checkout: NearbyCheckout
  pick: RepoPick | undefined
}>

/** The repos to list in the sheet: those with work on them, then the rest, each ticked or not. */
export function repoItems(checkouts: readonly NearbyCheckout[], ticked: Ticked): RepoItem[] {
  const item = (checkout: NearbyCheckout): RepoItem => ({
    kind: "repo",
    checkout,
    pick: ticked.get(checkout.path),
  })
  const withWork = checkouts.filter((checkout) => checkout.commits > 0)
  const rest = checkouts.filter((checkout) => checkout.commits === 0)

  return [...withWork, ...rest].map(item)
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

/** The branch a repo row names: the one taken for it, else what it has checked out. */
export function repoBranch({ checkout, pick }: RepoItem): string {
  return pick?.branch ?? checkout.branch ?? "a detached commit"
}

/**
 * What a repo row says after its branch: "4 commits", "passed through", "passed through · you
 * have spike/ledger out".
 */
export function repoNotes(item: RepoItem): string {
  return [workNote(item), passedNote(item), elsewhereNote(item)].filter(Boolean).join(" · ")
}

// Its commits, while it's read on what it has checked out.
function workNote({ checkout, pick }: RepoItem): string {
  const onCheckout = pick?.branch === undefined
  return onCheckout && checkout.commits > 0 ? count(checkout.commits, "commit") : ""
}

function passedNote({ pick }: RepoItem): string {
  return pick !== undefined && !pick.changed ? "passed through" : ""
}

// A branch taken that isn't the one checked out says what is.
function elsewhereNote({ checkout, pick }: RepoItem): string {
  const taken = pick?.branch
  const out = checkout.branch
  return taken === undefined || out === undefined || taken === out ? "" : `you have ${out} out`
}
