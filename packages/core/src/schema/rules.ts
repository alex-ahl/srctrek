// Rules that span steps, which no single step's schema can check. Each returns its problems
// rather than throwing, so one tour reports every problem at once.
import type { Tour } from "./tour"

type Issue = { path: (string | number)[]; message: string }

// Items whose key already appeared earlier in the list, with their positions.
function repeated<T>(items: T[], key: (item: T) => string): { item: T; index: number }[] {
  const keys = items.map(key)
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => keys.indexOf(key(item)) < index)
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

function unknownRepos(tour: Tour): Issue[] {
  const known = new Set(tour.repos.map((r) => r.name))
  const unknown = (repo: string) => !known.has(repo)
  return tour.steps.flatMap((s, i) => [
    ...(unknown(s.repo) ? [{ path: ["steps", i, "repo"], message: `unknown repo ${s.repo}` }] : []),
    ...(s.via?.cites ?? []).flatMap((c, j) =>
      unknown(c.repo)
        ? [{ path: ["steps", i, "via", "cites", j, "repo"], message: `unknown repo ${c.repo}` }]
        : [],
    ),
  ])
}

function danglingCalls(tour: Tour): Issue[] {
  const ids = new Set(tour.steps.map((s) => s.id))
  return tour.steps.flatMap((s, i) =>
    s.calls === undefined || ids.has(s.calls)
      ? []
      : [{ path: ["steps", i, "calls"], message: `calls unknown step ${s.calls}` }],
  )
}

// Every step after the first is a link: it names where execution came from, and cites its
// evidence.
function missingLinks(tour: Tour): Issue[] {
  return tour.steps.slice(1).flatMap((s, j) => [
    ...(s.from === undefined
      ? [
          {
            path: ["steps", j + 1, "from"],
            message: "missing: name the step execution came from",
          },
        ]
      : []),
    ...(s.via === null ? [{ path: ["steps", j + 1, "via"], message: "missing evidence" }] : []),
  ])
}

function danglingFrom(tour: Tour): Issue[] {
  const ids = new Set(tour.steps.map((s) => s.id))
  return tour.steps.flatMap((s, i) =>
    s.from === undefined || ids.has(s.from)
      ? []
      : [{ path: ["steps", i, "from"], message: `comes from unknown step ${s.from}` }],
  )
}

// A link from a step in another repo crosses repos; its evidence must cite both repos, or
// the link must admit it is a guess. Tour order can't stand in for `from`: async work
// (a queue consumer) runs after unrelated steps.
function oneSidedCrossRepoLinks(tour: Tour): Issue[] {
  const byId = new Map(tour.steps.map((s) => [s.id, s]))
  return tour.steps.flatMap((s, i) => {
    const source = s.from === undefined ? undefined : byId.get(s.from)
    if (!s.via || s.via.guessed || !source || source.repo === s.repo) return []
    const cited = new Set(s.via.cites.map((c) => c.repo))
    const missing = [source.repo, s.repo].filter((repo) => !cited.has(repo))
    if (missing.length === 0) return []
    return [
      {
        path: ["steps", i, "via"],
        message: `crosses from ${source.repo} to ${s.repo} without citing ${missing.join(" and ")}: cite both sides or mark guessed`,
      },
    ]
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
