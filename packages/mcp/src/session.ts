import {
  BUILD_STOPPED,
  type Draft,
  type ProposedRepo,
  type ReadAt,
  type ResolvedChange,
  type ResolvedRepo,
  type SubmittedStep,
  type Tour,
  type TourHeader,
  type Trigger,
  TourValidationError,
  addSteps,
  directoryIn,
  draftToTour,
  newDraft,
  parseRepoEntry,
  proposalProblems,
  readChangeArguments,
  repoNamed,
  resolveChange,
  saveChangedLines,
  saveProposal,
  saveTour,
  saveTriggers,
  stepIds,
  tourNameFor,
  withChange,
  withRouteRepo,
  workBranches,
  triggerProblems,
} from "@codetrail/core"

// Rejected rounds a draft may take before its build stops, so an agent can't loop on it.
const MAX_REJECTED_ROUNDS = 3

/** The change a tour is being built for, and the tour so far. Each tool needs the one before. */
export type Session = Readonly<{
  cwd: string
  cacheDir?: string | undefined
  change?: ResolvedChange | undefined
  draft?: Draft | undefined
  rejectedRounds: number
}>

/** What a tool call leaves behind: the session after it, and its answer. */
export type Outcome<T> = Readonly<{ session: Session; answer: T }>

/** How finishing went: the saved tour's path, or why the tour isn't valid yet. */
export type Finished = Readonly<{ saved: string } | { problems: string[] }>

export function newSession(cwd: string, cacheDir?: string): Session {
  return { cwd, cacheDir, rejectedRounds: 0 }
}

function openChange(session: Session): ResolvedChange {
  if (session.change === undefined) {
    throw new Error("no change is open: call open_change first")
  }

  return session.change
}

function openDraft(session: Session): Draft {
  if (session.draft === undefined) {
    throw new Error("no tour is started: call start_tour first")
  }

  return session.draft
}

export async function open(session: Session, args: string[]): Promise<Outcome<ResolvedChange>> {
  const read = readChangeArguments(args, directoryIn(session.cwd))
  const change = await resolveChange(session.cwd, read, session.cacheDir)

  return { session: { ...session, change, draft: undefined }, answer: change }
}

export function repoIn(session: Session, name: string): ResolvedRepo {
  return repoNamed(openChange(session), name)
}

export function start(session: Session, header: TourHeader): Session {
  return { ...session, draft: newDraft(openChange(session), header), rejectedRounds: 0 }
}

// A rejected round counts; the last one allowed drops the draft and says the build stopped.
function reject(session: Session, problems: readonly string[]): Outcome<string[]> {
  const rejectedRounds = session.rejectedRounds + 1
  if (rejectedRounds < MAX_REJECTED_ROUNDS) {
    return { session: { ...session, rejectedRounds }, answer: [...problems] }
  }

  const blankLine = ""
  const stopped = { ...session, draft: undefined, rejectedRounds }

  return { session: stopped, answer: [...problems, blankLine, BUILD_STOPPED] }
}

/** The problems with the steps; none when they were added. */
export async function addStepsTo(
  session: Session,
  steps: SubmittedStep[],
): Promise<Outcome<string[]>> {
  const { draft, problems } = await addSteps(openDraft(session), steps)
  if (problems.length > 0) {
    return reject(session, problems)
  }

  return { session: { ...session, draft }, answer: [] }
}

export function draftStepIds(session: Session): string[] {
  return stepIds(openDraft(session))
}

// The saved tour's path, or the error saying why the tour isn't valid; other failures throw.
async function saveOrInvalid(
  cwd: string,
  name: string,
  tour: Tour,
): Promise<{ path: string } | { invalid: TourValidationError }> {
  try {
    return { path: await saveTour(cwd, name, tour) }
  } catch (error) {
    if (error instanceof TourValidationError) {
      return { invalid: error }
    }

    throw error
  }
}

/**
 * Saves the tour under `.codetrail/tours`, with its changed lines beside it. A tour that fails
 * the whole-tour rules is a rejected round, like steps that fail theirs.
 */
export async function finish(session: Session, name: string): Promise<Outcome<Finished>> {
  const draft = openDraft(session)
  const tour = draftToTour(draft)

  const result = await saveOrInvalid(session.cwd, name, tour)
  if ("invalid" in result) {
    const rejected = reject(session, [result.invalid.message])
    return { session: rejected.session, answer: { problems: rejected.answer } }
  }

  await saveChangedLines(draft.change, tour, result.path)

  return { session: { ...session, draft: undefined }, answer: { saved: result.path } }
}

/**
 * Records the triggers found in code opened with plain --code, for the user to choose from:
 * where they were saved, or the problems with their evidence.
 */
export async function recordTriggers(session: Session, triggers: Trigger[]): Promise<Finished> {
  const change = openChange(session)
  if (change.code === undefined || change.code.trigger !== undefined) {
    throw new Error("record_triggers is for code opened with --code and no trigger")
  }

  const problems = await triggerProblems(change, triggers)
  if (problems.length > 0) {
    return { problems }
  }

  return { saved: await saveTriggers(session.cwd, await tourNameFor(change), change, triggers) }
}

/**
 * How a proposal went: refused for its problems, or recorded, and opened when it could be, so
 * the tour goes on into it.
 */
export type Proposed = Readonly<
  { problems: string[] } | { opened: ResolvedRepo; readAt: ReadAt } | { notOpened: string }
>

// The session with `change` open, and the draft, if any, over it.
function widened(session: Session, change: ResolvedChange): Session {
  const draft = session.draft === undefined ? undefined : withChange(session.draft, change)

  return { ...session, change, draft }
}

// Opens the proposed repo in the change. A source that isn't a repo, or can't be fetched,
// leaves the proposal for the user and the hop at the boundary, so it isn't thrown.
async function openProposed(
  session: Session,
  name: string,
  source: string,
): Promise<Outcome<Proposed>> {
  const change = openChange(session)
  const entry = { ...parseRepoEntry(source), name }
  try {
    const branches = await workBranches(session.cwd, change)
    const added = await withRouteRepo(session.cwd, change, entry, branches, session.cacheDir)
    const opened = repoNamed(added.change, name)

    return { session: widened(session, added.change), answer: { opened, readAt: added.readAt } }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { session, answer: { notOpened: reason } }
  }
}

/**
 * Records a repo the route leads into, for the user to add or dismiss, and opens it when the
 * agent found where it lives.
 */
export async function proposeRepo(
  session: Session,
  proposal: ProposedRepo,
): Promise<Outcome<Proposed>> {
  const problems = await proposalProblems(openChange(session), proposal)
  if (problems.length > 0) {
    return { session, answer: { problems } }
  }

  await saveProposal(session.cwd, proposal)
  if (proposal.source === undefined) {
    return { session, answer: { notOpened: "no source was given" } }
  }

  return openProposed(session, proposal.name, proposal.source)
}
