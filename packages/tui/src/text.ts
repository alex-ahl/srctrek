/** "1 step", "19 steps". */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`
}

/** `text` cut to `width` characters, ending in "…" when cut. */
export function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

const DAY_MS = 24 * 60 * 60 * 1000

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** When a trek was built, as near as a person needs: "today 09:12", "yesterday", "Mon", "Oct 21". */
export function builtWhen(createdAt: string, now: Date): string {
  const built = new Date(createdAt)
  const daysAgo = Math.round((startOfDay(now) - startOfDay(built)) / DAY_MS)

  if (daysAgo === 0) {
    return `today ${built.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
  }

  if (daysAgo === 1) {
    return "yesterday"
  }

  if (daysAgo > 1 && daysAgo < 7) {
    return built.toLocaleDateString("en-GB", { weekday: "short" })
  }

  const sameYear = built.getFullYear() === now.getFullYear()
  return built.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}
