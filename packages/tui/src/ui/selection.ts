/** The selected line: the one with the key chosen, so it stays put as lines load around it. */
export function selectedIndex<T>(
  items: readonly T[],
  chosen: string | undefined,
  keyOf: (item: T) => string,
): number {
  const at = items.findIndex((item) => keyOf(item) === chosen)
  return at === -1 ? 0 : at
}

/** The key of the line at `at`, none past the list. */
export function keyAt<T>(
  items: readonly T[],
  at: number,
  keyOf: (item: T) => string,
): string | undefined {
  const item = items[at]
  return item === undefined ? undefined : keyOf(item)
}
