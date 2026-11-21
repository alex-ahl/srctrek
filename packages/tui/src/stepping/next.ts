import type { RouteStop } from "./route"

/**
 * How the trek moves on to `to` from `from`, in words before its name: back to a caller, on to a
 * stop something else led to, across a hop and what carries it, or into a call.
 */
export function howNext(from: RouteStop, to: RouteStop): string {
  if (to.kind === "return") {
    return "back to"
  }

  if (to.from !== from.id) {
    return "on to"
  }

  if (to.kind === "hop") {
    return `↯ ${to.through ?? "hop"} to`
  }

  return "into"
}

/** A stop's name, with its repo when that isn't `from`'s: "billing: charge". */
export const nameFrom = (from: RouteStop, to: RouteStop) =>
  to.repo === from.repo ? to.name : `${to.repo}: ${to.name}`

/** Where n goes, in words: "into pay", "↯ on a click to web: Build", "back to checkout", "the end". */
export function nextText(from: RouteStop | undefined, to: RouteStop | undefined): string {
  return from === undefined || to === undefined
    ? "the end"
    : `${howNext(from, to)} ${nameFrom(from, to)}`
}
