/** "1 step", "19 steps". */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`
}

/** `text` cut to `width` characters, ending in "…" when cut. */
export function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

/**
 * A path cut to `width` characters by dropping folders from its start, "…/home/screen.tsx"; cut
 * from the left within the last part when even that doesn't fit.
 */
export function fitPath(path: string, width: number): string {
  if (path.length <= width) {
    return path
  }

  const parts = path.split("/")
  const fits = (from: number) => `…/${parts.slice(from).join("/")}`.length <= width
  const from = parts.findIndex((_, i) => i > 0 && fits(i))
  const shown = `…/${parts.slice(from === -1 ? -1 : from).join("/")}`
  return shown.length <= width ? shown : `…${shown.slice(shown.length - Math.max(0, width - 1))}`
}

/** `text` broken into lines of at most `width` characters, at spaces. */
export function wrap(text: string, width: number): string[] {
  return text.split(" ").reduce<string[]>((lines, word) => {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + word.length <= width) {
      return [...lines.slice(0, -1), `${last} ${word}`]
    }

    return [...lines, word]
  }, [])
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

const AGES: ReadonlyArray<readonly [number, string]> = [
  [365 * DAY_MS, "y"],
  [30 * DAY_MS, "mo"],
  [7 * DAY_MS, "w"],
  [DAY_MS, "d"],
  [60 * 60 * 1000, "h"],
  [60 * 1000, "m"],
]

/** How long ago, in the largest unit that fits: "10m ago", "2h ago", "3w ago"; "just now" first. */
export function shortAge(at: string, now: Date): string {
  const ago = now.getTime() - new Date(at).getTime()
  const unit = AGES.find(([size]) => ago >= size)

  return unit === undefined ? "just now" : `${Math.floor(ago / unit[0])}${unit[1]} ago`
}
