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

type NamedStep = { id: string; path: Path; message: string }

// Every step a step names by id: each it steps into, where execution came from, and the step
// it explains.
function stepsNamedBy(step: TourStep, i: number): NamedStep[] {
  const named = (id: string | undefined, path: Path, message: string): NamedStep[] =>
    id === undefined ? [] : [{ id, path: ["steps", i, ...path], message }]

  return [
    ...(step.calls ?? []).flatMap((id, j) => named(id, ["calls", j], `calls unknown step ${id}`)),
    ...named(step.from, ["from"], `comes from unknown step ${step.from}`),
    ...named(step.for, ["for"], `explains unknown step ${step.for}`),
  ]
}

function danglingStepIds(tour: Tour): Issue[] {
  const ids = new Set(tour.steps.map((s) => s.id))

  return tour.steps
    .flatMap(stepsNamedBy)
    .filter(({ id }) => !ids.has(id))
    .map(({ path, message }) => ({ path, message }))
}

// A context step explains another step and isn't executed: it names the step it explains,
// never where execution came from, and cites why it belongs there.
function contextLinks(step: TourStep, i: number): Issue[] {
  return [
    ...issueIf(
      step.for === undefined,
      ["steps", i, "for"],
      "missing: name the step this context explains",
    ),
    ...issueIf(
      step.from !== undefined,
      ["steps", i, "from"],
      "a context step isn't executed: name the step it explains with for, not from",
    ),
    ...issueIf(step.via === null, ["steps", i, "via"], "missing evidence"),
  ]
}

// Every executed step after the first is a link: it names where execution came from, and
// cites its evidence.
function executionLinks(step: TourStep, i: number): Issue[] {
  return [
    ...issueIf(
      step.for !== undefined,
      ["steps", i, "for"],
      "only a context step explains another; this one is executed",
    ),
    ...issueIf(
      i > 0 && step.from === undefined,
      ["steps", i, "from"],
      "missing: name the step execution came from",
    ),
    ...issueIf(i > 0 && step.via === null, ["steps", i, "via"], "missing evidence"),
  ]
}

function linksByKind(tour: Tour): Issue[] {
  return tour.steps.flatMap((step, i) =>
    step.kind === "context" ? contextLinks(step, i) : executionLinks(step, i),
  )
}

// Execution never comes from or steps into a context step, which isn't executed.
function linksIntoContext(tour: Tour): Issue[] {
  const context = new Set(tour.steps.filter((s) => s.kind === "context").map((s) => s.id))

  return tour.steps.flatMap((step, i) => [
    ...issueIf(
      step.from !== undefined && context.has(step.from),
      ["steps", i, "from"],
      `comes from context step ${step.from}, which isn't executed: name the step execution came from`,
    ),
    ...(step.calls ?? []).flatMap((id, j) =>
      issueIf(context.has(id), ["steps", i, "calls", j], `steps into context step ${id}`),
    ),
  ])
}

// A link to a step in another repo crosses repos, whether execution came from it or a
// context step explains it; its evidence must cite both repos, or the link must admit it is
// a guess. Tour order can't stand in for the link: async work (a queue consumer) runs after
// unrelated steps.
function oneSidedCrossRepoLinks(tour: Tour): Issue[] {
  const byId = new Map(tour.steps.map((s) => [s.id, s]))

  return tour.steps.flatMap((step, i) => {
    const linkedId = step.from ?? step.for
    const linked = linkedId === undefined ? undefined : byId.get(linkedId)
    const crossesRepos = linked !== undefined && linked.repo !== step.repo
    if (!crossesRepos || !step.via || step.via.guessed) {
      return []
    }

    const cited = new Set(step.via.cites.map((c) => c.repo))
    const missing = [linked.repo, step.repo].filter((repo) => !cited.has(repo))

    return issueIf(
      missing.length > 0,
      ["steps", i, "via"],
      `crosses from ${linked.repo} to ${step.repo} without citing ${missing.join(" and ")}: cite both sides or mark guessed`,
    )
  })
}

export const tourRules = [
  duplicateRepoNames,
  duplicateStepIds,
  unknownRepos,
  danglingStepIds,
  linksByKind,
  linksIntoContext,
  oneSidedCrossRepoLinks,
]
