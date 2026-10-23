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
function missingEvidence(tour: Tour): Issue[] {
  return tour.steps.flatMap((s, i) =>
    i > 0 && s.via === null ? [{ path: ["steps", i, "via"], message: "missing evidence" }] : [],
  )
}

// A link that cites another repo crosses repos, so it must also cite the step's own repo,
// or admit it is a guess.
function oneSidedCrossRepoLinks(tour: Tour): Issue[] {
  return tour.steps.flatMap((s, i) => {
    if (!s.via || s.via.guessed) return []
    const cited = new Set(s.via.cites.map((c) => c.repo))
    const crosses = [...cited].some((repo) => repo !== s.repo)
    return crosses && !cited.has(s.repo)
      ? [
          {
            path: ["steps", i, "via"],
            message: `crosses repos without citing ${s.repo}: cite both sides or mark guessed`,
          },
        ]
      : []
  })
}

export const tourRules = [
  duplicateRepoNames,
  duplicateStepIds,
  unknownRepos,
  danglingCalls,
  missingEvidence,
  oneSidedCrossRepoLinks,
]
