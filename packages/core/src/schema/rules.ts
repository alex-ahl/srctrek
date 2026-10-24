// Rules that span steps, which no single step's schema can check. Each returns its problems
// rather than throwing, so one tour reports every problem at once.
import type { Tour } from "./tour"

type Issue = { path: (string | number)[]; message: string }

function duplicateRepoNames(tour: Tour): Issue[] {
  const seen = new Set<string>()
  return tour.repos.flatMap((r, i) => {
    if (!seen.has(r.name)) {
      seen.add(r.name)
      return []
    }
    return [{ path: ["repos", i, "name"], message: `duplicate repo name ${r.name}` }]
  })
}

function duplicateStepIds(tour: Tour): Issue[] {
  const seen = new Set<string>()
  return tour.steps.flatMap((s, i) => {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      return []
    }
    return [{ path: ["steps", i, "id"], message: `duplicate step id ${s.id}` }]
  })
}

function unknownRepos(tour: Tour): Issue[] {
  const names = new Set(tour.repos.map((r) => r.name))
  return tour.steps.flatMap((s, i) => {
    const issues: Issue[] = []
    if (!names.has(s.repo)) {
      issues.push({ path: ["steps", i, "repo"], message: `unknown repo ${s.repo}` })
    }
    s.via?.cites.forEach((c, j) => {
      if (!names.has(c.repo)) {
        issues.push({
          path: ["steps", i, "via", "cites", j, "repo"],
          message: `unknown repo ${c.repo}`,
        })
      }
    })
    return issues
  })
}

function danglingCalls(tour: Tour): Issue[] {
  const ids = new Set(tour.steps.map((s) => s.id))
  return tour.steps.flatMap((s, i) =>
    s.calls === undefined || ids.has(s.calls)
      ? []
      : [{ path: ["steps", i, "calls"], message: `calls unknown step ${s.calls}` }],
  )
}

// Every link cites its evidence: only the first step may arrive without one.
// Every step after the first is a link: it names where execution came from, and cites its
// evidence.
function missingLinks(tour: Tour): Issue[] {
  return tour.steps.slice(1).flatMap((s, j) => {
    const i = j + 1
    const issues: Issue[] = []
    if (s.from === undefined) {
      issues.push({
        path: ["steps", i, "from"],
        message: "missing: name the step execution came from",
      })
    }
    if (s.via === null) issues.push({ path: ["steps", i, "via"], message: "missing evidence" })
    return issues
  })
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
