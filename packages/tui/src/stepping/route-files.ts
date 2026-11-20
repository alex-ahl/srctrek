import type { RouteStop } from "./route"

/** A file the trek stops in: its repo, its folder and name, and its stops by index, in order. */
export type TrekFile = Readonly<{
  repo: string
  // the folder in the repo, "packages/tui/src/home/"; empty at the repo's top
  dir: string
  name: string
  stops: readonly number[]
}>

const dirOf = (file: string) => file.slice(0, file.lastIndexOf("/") + 1)

/**
 * The files the `shown` stops are in: by repo in the order the trek reaches them, then by folder,
 * then in the order the trek reaches each file.
 */
export function filesOf(route: readonly RouteStop[], shown: readonly number[]): TrekFile[] {
  const files = new Map<string, { repo: string; dir: string; name: string; stops: number[] }>()
  for (const index of shown) {
    const stop = route[index]
    if (stop === undefined) {
      continue
    }

    const key = `${stop.repo}\u0000${stop.file}`
    const file = files.get(key) ?? {
      repo: stop.repo,
      dir: dirOf(stop.file),
      name: stop.file.slice(dirOf(stop.file).length),
      stops: [],
    }
    files.set(key, { ...file, stops: [...file.stops, index] })
  }

  const all = [...files.values()]
  const repos = [...new Set(all.map((file) => file.repo))]
  return repos.flatMap((repo) => {
    const inRepo = all.filter((file) => file.repo === repo)
    const dirs = [...new Set(inRepo.map((file) => file.dir))].toSorted()
    return dirs.flatMap((dir) => inRepo.filter((file) => file.dir === dir))
  })
}

/**
 * The stop a file stands for: the one the trek is on when it's in the file, else its first not
 * yet stepped to, else its first.
 */
export function stopFor(route: readonly RouteStop[], file: TrekFile, at: number): number {
  if (file.stops.includes(at)) {
    return at
  }

  const unseen = file.stops.find((index) => route[index]?.visited === false)
  return unseen ?? file.stops[0] ?? at
}
