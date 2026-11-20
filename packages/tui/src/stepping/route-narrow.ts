import { type RouteStop, hiddenBy } from "./route"

/**
 * How the route map is narrowed: to changed or flagged stops, to stops whose name has `find` in
 * it, and whether `find` is being typed.
 */
export type Narrow = Readonly<{
  only: "changed" | "flagged" | undefined
  find: string
  finding: boolean
}>

export const WHOLE: Narrow = { only: undefined, find: "", finding: false }

export const narrowed = (narrow: Narrow) => narrow.only !== undefined || narrow.find !== ""

// Whether a stop is kept by the narrowing: changed or flagged as asked, its name matching.
function kept(stop: RouteStop, narrow: Narrow): boolean {
  const only =
    narrow.only === undefined ||
    (narrow.only === "changed" ? stop.changed : stop.flag !== undefined)
  return only && stop.name.toLowerCase().includes(narrow.find.toLowerCase())
}

/**
 * The stops the map shows, by index: those narrowed to, folds and all, when it's narrowed; else
 * every stop no folded call hides.
 */
export function shownOf(
  route: readonly RouteStop[],
  folded: ReadonlySet<string>,
  narrow: Narrow,
): number[] {
  const hidden = narrowed(narrow) ? new Set<string>() : hiddenBy(route, folded)
  return route.flatMap((stop, index) => (hidden.has(stop.id) || !kept(stop, narrow) ? [] : [index]))
}

/**
 * "showing changed · find "read" · 3 found", what the map is narrowed to, a cursor in the find
 * while it's typed; empty when it isn't narrowed.
 */
export function narrowText(narrow: Narrow, count: number): string {
  const only = narrow.only === undefined ? [] : [`showing ${narrow.only}`]
  const cursor = narrow.finding ? "▏" : ""
  const find = narrow.find === "" && !narrow.finding ? [] : [`find "${narrow.find}${cursor}"`]
  const parts = [...only, ...find]
  return parts.length === 0 ? "" : `${parts.join(" · ")} · ${String(count)} found`
}
