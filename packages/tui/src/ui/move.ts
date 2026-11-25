/** A selection moved `by` lines from `at`, kept within a list `count` lines long. */
export function stepped(at: number, by: number, count: number): number {
  return Math.min(Math.max(at + by, 0), Math.max(count - 1, 0))
}

/** A list's moving keys for its key map: ↓ and j one line on, ↑ and k one line back. */
export function moveKeys(move: (by: number) => void): Array<[string, () => void]> {
  return [
    ["down", () => move(1)],
    ["j", () => move(1)],
    ["up", () => move(-1)],
    ["k", () => move(-1)],
  ]
}

/** A key as key maps name it: a letter typed with shift as its capital, "B", as it's shown. */
export const shifted = (key: Readonly<{ name: string; shift: boolean }>): string =>
  key.shift && key.name.length === 1 ? key.name.toUpperCase() : key.name
