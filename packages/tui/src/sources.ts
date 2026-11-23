import {
  type BranchChoices,
  type BuildRecord,
  type ChangeChoice,
  type NearbyCheckout,
  type OpenPullRequest,
  type OverviewView,
  type ProposedRepo,
  type PullRequestDetails,
  type RepoBranches,
  type TrekEntry,
  type TrekStatus,
  acceptProposal,
  branchChoices,
  buildHistory,
  choiceStatus,
  dismissProposal,
  fetchRepo,
  loadProposals,
  loadTrekEntries,
  nearbyCheckouts,
  openPullRequests,
  pullRequestOf,
  readBuild as readBuildAt,
  repoBranches,
  stopBuild,
  trekStates,
} from "@srctrek/core"
import { resolve } from "node:path"
import type { BuildRead } from "./build-view/read"
import type { OpenChange } from "./change/open-change"
import { overviewOf } from "./change/overview"
import type { DoneTrek } from "./landing/rows"
import { doneLabel } from "./ui/state-labels"
import type { Stamp } from "./watch/follow"

/**
 * Everything the screens read and change, apart from the screens: the changes to list, where
 * their treks stand, opening one, the saved treks and their builds, and the repos proposed.
 */
export type Sources = Readonly<{
  load: () => Promise<BranchChoices>
  pullRequests: () => Promise<OpenPullRequest[]>
  // the view before the first stop of the trek saved under this name
  overview: (name: string) => Promise<OverviewView | undefined>
  // the pull request at a link: its title, who opened it, and whether it's a draft
  pullRequest: (url: string) => Promise<PullRequestDetails>
  nearby: () => Promise<NearbyCheckout[]>
  repoBranches: (path: string) => Promise<RepoBranches>
  fetchRepo: (path: string) => Promise<void>
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  done: () => Promise<DoneTrek[]>
  // the change trek's args name, as it stands now
  open: (args: string[]) => Promise<OpenChange>
  stamp: Stamp
  entries: () => Promise<TrekEntry[]>
  proposals: () => Promise<ProposedRepo[]>
  addRepo: (name: string, location?: string) => Promise<void>
  dismissRepo: (name: string) => Promise<void>
  stopBuild: (name: string) => Promise<void>
  // a build of the trek by this name, `back` before its latest
  readBuild: (name: string, back: number) => Promise<BuildRead>
}>

/** How trek's own command opens a change and follows it, for the screens to use. */
export type Ways = Readonly<{ open: Sources["open"]; stamp: Stamp }>

// A trek with no build kept: nothing to show yet.
const NO_BUILD: BuildRecord = {
  log: [],
  steps: [],
  state: undefined,
  started: undefined,
  ended: undefined,
}

// The saved treks whose work has landed or gone, with how it ended in a word.
async function doneTreks(root: string): Promise<DoneTrek[]> {
  const entries = await loadTrekEntries(root)
  const states = await trekStates(root, entries)
  return entries.flatMap((entry) => {
    const state = states.get(entry.name)
    if (!entry.valid || state?.kind !== "done") {
      return []
    }

    return [{ name: entry.name, title: entry.title, why: doneLabel(state.why).state }]
  })
}

// The build `back` before the latest of trek `name`, as it stands, and how many it has.
async function readBuild(root: string, name: string, back: number): Promise<BuildRead> {
  const builds = await buildHistory(root, name)
  const build = builds[back]
  const read = build === undefined ? NO_BUILD : await readBuildAt(root, name, build)
  return { ...read, count: builds.length }
}

/** The screens' sources for the repo at `root`, opening and following changes `ways`. */
export function sourcesAt(root: string, ways: Ways): Sources {
  return {
    load: () => branchChoices(root),
    pullRequests: () => openPullRequests(root),
    pullRequest: (url) => pullRequestOf(root, url),
    overview: (name) => overviewOf(root, name),
    nearby: () => nearbyCheckouts(root),
    repoBranches: (path) => repoBranches(resolve(root, path)),
    fetchRepo: (path) => fetchRepo(resolve(root, path)),
    status: (choice) => choiceStatus(root, choice),
    done: () => doneTreks(root),
    open: ways.open,
    stamp: ways.stamp,
    entries: () => loadTrekEntries(root),
    proposals: () => loadProposals(root),
    addRepo: (name, location) => acceptProposal(root, name, location),
    dismissRepo: (name) => dismissProposal(root, name),
    stopBuild: (name) => stopBuild(root, name),
    readBuild: (name, back) => readBuild(root, name, back),
  }
}
