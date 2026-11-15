import {
  type ChangeChoice,
  branchChoices,
  choiceArguments,
  choiceStatus,
  fetchRepo,
  nearbyCheckouts,
  openPullRequests,
  repoBranches,
} from "@srctrek/core"
import { resolve } from "node:path"
import { useCallback } from "react"
import type { Choosing } from "./app"
import type { FollowChange } from "./follow"
import type { HomeChange } from "./home"
import { failureReason } from "./opening-line"

// What a pick tells the home screen: it's under way, it opened, or why it couldn't.
export type PickEvents = Readonly<{
  onOpening: (choice: ChangeChoice) => void
  onPicked: (choice: ChangeChoice, change: HomeChange) => void
  onFailed: (choice: ChangeChoice, why: string) => void
}>

/**
 * What the change picker needs from here: the choice now, this repo's branches and pull requests,
 * and a pick that works out the picked change before handing it on, saying how it goes. Without a
 * way to reopen, there's no picker.
 */
export function useChoosing(
  root: string,
  follow: FollowChange | undefined,
  choice: ChangeChoice,
  events: PickEvents,
): Choosing | undefined {
  const load = useCallback(() => branchChoices(root), [root])
  const pullRequests = useCallback(() => openPullRequests(root), [root])
  const nearby = useCallback(() => nearbyCheckouts(root), [root])
  const branches = useCallback((path: string) => repoBranches(resolve(root, path)), [root])
  const fetch = useCallback((path: string) => fetchRepo(resolve(root, path)), [root])
  const status = useCallback((each: ChangeChoice) => choiceStatus(root, each), [root])
  if (follow === undefined) {
    return undefined
  }

  const onPick = (picked: ChangeChoice) => {
    events.onOpening(picked)
    void follow.open(choiceArguments(picked)).then(
      (next) => events.onPicked(picked, next),
      (error: unknown) => events.onFailed(picked, failureReason(error)),
    )
  }

  return {
    choice,
    load,
    pullRequests,
    nearby,
    repoBranches: branches,
    fetchRepo: fetch,
    status,
    onPick,
  }
}
