// Rules that span steps, which no single step's schema can check. Each returns its problems
// rather than throwing, so one trek reports every problem at once.
import { callStacks } from "./stacks"
import type { Trek, TrekStep } from "./trek"

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

function duplicateRepoNames(trek: Trek): Issue[] {
  return repeated(trek.repos, (r) => r.name).map(({ item, index }) => ({
    path: ["repos", index, "name"],
    message: `duplicate repo name ${item.name}`,
  }))
}

function duplicateStepIds(trek: Trek): Issue[] {
  return repeated(trek.steps, (s) => s.id).map(({ item, index }) => ({
    path: ["steps", index, "id"],
    message: `duplicate step id ${item.id}`,
  }))
}

// Every repo a step names: its own, then each one its evidence cites.
function reposNamedBy(step: TrekStep, i: number): { repo: string; path: Path }[] {
  const own = { repo: step.repo, path: ["steps", i, "repo"] }
  const cited = (step.via?.cites ?? []).map((cite, j) => ({
    repo: cite.repo,
    path: ["steps", i, "via", "cites", j, "repo"],
  }))

  return [own, ...cited]
}

function unknownRepos(trek: Trek): Issue[] {
  const known = new Set(trek.repos.map((r) => r.name))

  return trek.steps
    .flatMap(reposNamedBy)
    .filter(({ repo }) => !known.has(repo))
    .map(({ repo, path }) => ({ path, message: `unknown repo ${repo}` }))
}

type NamedStep = { id: string; path: Path; message: string }

// Every step a step names by id: where execution came from, and the step it explains.
function stepsNamedBy(step: TrekStep, i: number): NamedStep[] {
  const named = (id: string | undefined, path: Path, message: string): NamedStep[] =>
    id === undefined ? [] : [{ id, path: ["steps", i, ...path], message }]

  return [
    ...named(step.from, ["from"], `comes from unknown step ${step.from}`),
    ...named(step.for, ["for"], `explains unknown step ${step.for}`),
  ]
}

function danglingStepIds(trek: Trek): Issue[] {
  const ids = new Set(trek.steps.map((s) => s.id))

  return trek.steps
    .flatMap(stepsNamedBy)
    .filter(({ id }) => !ids.has(id))
    .map(({ path, message }) => ({ path, message }))
}

// A context step explains another step and isn't executed: it names the step it explains,
// never where execution came from, and cites why it belongs there.
function contextLinks(step: TrekStep, i: number): Issue[] {
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
function executionLinks(step: TrekStep, i: number): Issue[] {
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

// A hop says what carries it, as the reader can't see it in the code: a request, a timer, an
// agent. Only a hop does; the first step, reached from the trigger, has no link to carry.
function hopCarriers(trek: Trek): Issue[] {
  return trek.steps.flatMap((step, i) => {
    const through = step.via?.through
    const path = ["steps", i, "via", "through"]
    if (step.kind !== "hop") {
      return issueIf(through !== undefined, path, "only a hop says what carries it")
    }

    return issueIf(
      step.via !== null && through === undefined,
      path,
      'missing: say what carries the hop, in a few words: "via the agent", "on a timer"',
    )
  })
}

function linksByKind(trek: Trek): Issue[] {
  return trek.steps.flatMap((step, i) =>
    step.kind === "context" ? contextLinks(step, i) : executionLinks(step, i),
  )
}

// Execution never comes from a context step, which isn't executed.
function executionFromContext(trek: Trek): Issue[] {
  const context = new Set(trek.steps.filter((s) => s.kind === "context").map((s) => s.id))

  return trek.steps.flatMap((step, i) =>
    issueIf(
      step.from !== undefined && context.has(step.from),
      ["steps", i, "from"],
      `comes from context step ${step.from}, which isn't executed: name the step execution came from`,
    ),
  )
}

// Steps are in execution order, so execution comes from a step before this one; the call
// stacks are worked out in one pass on that.
function fromLaterSteps(trek: Trek): Issue[] {
  const position = new Map(trek.steps.map((s, i) => [s.id, i]))

  return trek.steps.flatMap((step, i) =>
    issueIf(
      (position.get(step.from ?? "") ?? -1) >= i,
      ["steps", i, "from"],
      `comes from ${step.from}, which isn't before it: execution comes from an earlier step`,
    ),
  )
}

// A return goes back to code a step on the call stack showed. A value handed on to another
// function is a call; code that runs later is a hop.
function misplacedReturns(trek: Trek): Issue[] {
  const misplaced = new Set(callStacks(trek.steps).misplacedReturns)

  return trek.steps.flatMap((step, i) =>
    issueIf(
      misplaced.has(step.id),
      ["steps", i, "kind"],
      `returns to ${step.file}, which no step on the stack below ${step.from} is in: a function the value is handed to is a call, code that runs later is a hop`,
    ),
  )
}

// A link to a step in another repo crosses repos, whether execution came from it or a
// context step explains it; its evidence must cite both repos, or the link must admit it is
// a guess. Trek order can't stand in for the link: async work (a queue consumer) runs after
// unrelated steps.
function oneSidedCrossRepoLinks(trek: Trek): Issue[] {
  const byId = new Map(trek.steps.map((s) => [s.id, s]))

  return trek.steps.flatMap((step, i) => {
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

export const trekRules = [
  duplicateRepoNames,
  duplicateStepIds,
  unknownRepos,
  danglingStepIds,
  linksByKind,
  hopCarriers,
  executionFromContext,
  fromLaterSteps,
  misplacedReturns,
  oneSidedCrossRepoLinks,
]
