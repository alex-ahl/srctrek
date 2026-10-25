// Rules that span steps, which no single step's schema can check. Each returns its problems
// rather than throwing, so one tour reports every problem at once.
import type { Tour, TourStep } from "./tour"

type Path = (string | number)[]
type Issue = { path: Path; message: string }

// One issue when `found`, none otherwise, so a check reads as its condition.
function issueIf(found: boolean, path: Path, message: string): Issue[] {
  return found ? [{ path, message }] : []
}

// Items whose key already appeared earlier in the list, with their positions.
function repeated<T>(items: T[], key: (item: T) => string): { item: T; index: number }[] {
  const appearsEarlier = (item: T, index: number) =>
    items.slice(0, index).some((earlier) => key(earlier) === key(item))

  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => appearsEarlier(item, index))
}

function duplicateRepoNames(tour: Tour): Issue[] {
  return repeated(tour.repos, (r) => r.name).map(({ item, index }) => ({
    path: ["repos", index, "name"],
    message: `duplicate repo name ${item.name}`,
  }))
}

function duplicateStepIds(tour: Tour): Issue[] {
  return repeated(tour.steps, (s) => s.id).map(({ item, index }) => ({
    path: ["steps", index, "id"],
    message: `duplicate step id ${item.id}`,
  }))
}

// Every repo a step names: its own, then each one its evidence cites.
function reposNamedBy(step: TourStep, i: number): { repo: string; path: Path }[] {
  const own = { repo: step.repo, path: ["steps", i, "repo"] }
  const cited = (step.via?.cites ?? []).map((cite, j) => ({
    repo: cite.repo,
    path: ["steps", i, "via", "cites", j, "repo"],
  }))

  return [own, ...cited]
}

function unknownRepos(tour: Tour): Issue[] {
  const known = new Set(tour.repos.map((r) => r.name))

  return tour.steps
    .flatMap(reposNamedBy)
    .filter(({ repo }) => !known.has(repo))
    .map(({ repo, path }) => ({ path, message: `unknown repo ${repo}` }))
}

function danglingCalls(tour: Tour): Issue[] {
  const ids = new Set(tour.steps.map((s) => s.id))

  return tour.steps.flatMap(({ calls }, i) =>
    issueIf(
      calls !== undefined && !ids.has(calls),
      ["steps", i, "calls"],
      `calls unknown step ${calls}`,
    ),
  )
}

function danglingFrom(tour: Tour): Issue[] {
  const ids = new Set(tour.steps.map((s) => s.id))

  return tour.steps.flatMap(({ from }, i) =>
    issueIf(
      from !== undefined && !ids.has(from),
      ["steps", i, "from"],
      `comes from unknown step ${from}`,
    ),
  )
}

// Every step after the first is a link: it names where execution came from, and cites its
// evidence.
function missingLinks(tour: Tour): Issue[] {
  const links = tour.steps.map((step, i) => ({ step, i })).slice(1)

  return links.flatMap(({ step, i }) => [
    ...issueIf(
      step.from === undefined,
      ["steps", i, "from"],
      "missing: name the step execution came from",
    ),
    ...issueIf(step.via === null, ["steps", i, "via"], "missing evidence"),
  ])
}

// A link from a step in another repo crosses repos; its evidence must cite both repos, or
// the link must admit it is a guess. Tour order can't stand in for `from`: async work
// (a queue consumer) runs after unrelated steps.
function oneSidedCrossRepoLinks(tour: Tour): Issue[] {
  const byId = new Map(tour.steps.map((s) => [s.id, s]))

  return tour.steps.flatMap((step, i) => {
    const source = step.from === undefined ? undefined : byId.get(step.from)
    const crossesRepos = source !== undefined && source.repo !== step.repo
    if (!crossesRepos || !step.via || step.via.guessed) {
      return []
    }

    const cited = new Set(step.via.cites.map((c) => c.repo))
    const missing = [source.repo, step.repo].filter((repo) => !cited.has(repo))

    return issueIf(
      missing.length > 0,
      ["steps", i, "via"],
      `crosses from ${source.repo} to ${step.repo} without citing ${missing.join(" and ")}: cite both sides or mark guessed`,
    )
  })
}

export const tourRules = [
  duplicateRepoNames,
  duplicateStepIds,
  unknownRepos,
  danglingCalls,
  danglingFrom,
  missingLinks,
  oneSidedCrossRepoLinks,
]
