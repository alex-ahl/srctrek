/** The slice of a list that shows `fits` items with the selected one among them, centred. */
export function visibleWindow(
  total: number,
  selected: number,
  fits: number,
): { start: number; end: number } {
  if (total <= fits) {
    return { start: 0, end: total }
  }

  const centred = selected - Math.floor(fits / 2)
  const start = Math.min(Math.max(centred, 0), total - fits)

  return { start, end: start + fits }
}
