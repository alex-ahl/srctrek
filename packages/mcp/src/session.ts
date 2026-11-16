import {
  type Draft,
  type ProposedRepo,
  type ReadAt,
  type ResolvedChange,
  type ResolvedRepo,
  type SubmittedStep,
  type Trek,
  type TrekHeader,
  type Trigger,
  type UpdateStep,
  BUILD_STOPPED,
  NO_CHANGE_OPEN,
  NO_TREK_STARTED,
  TrekValidationError,
  addSteps,
  carryOver,
  changeFromArguments,
  draftToTrek,
  errorText,
  loadTrek,
  newDraft,
  parseRepoEntry,
  proposalProblems,
  repoNamed,
  saveProposal,
  saveTrek,
  saveTriggers,
  stepIds,
  trekNameFor,
  trekPath,
  triggerProblems,
  withChange,
  withRouteRepo,
  workBranches,
} from "@srctrek/core"

// Rejected rounds a draft may take before its build stops, so an agent can't loop on it.
const MAX_REJECTED_ROUNDS = 3

/** The change a trek is being built for, and the trek so far. Each tool needs the one before. */
export type Session = Readonly<{
  cwd: string
  cacheDir?: string | undefined
  change?: ResolvedChange | undefined
  draft?: Draft | undefined
  rejectedRounds: number
}>

/** What a tool call leaves behind: the session after it, and its answer. */
export type Outcome<T> = Readonly<{ session: Session; answer: T }>

/** How finishing went: the saved trek's path, or why the trek isn't valid yet. */
export type Finished = Readonly<{ saved: string } | { problems: string[] }>

export function newSession(cwd: string, cacheDir?: string): Session {
  return { cwd, cacheDir, rejectedRounds: 0 }
}

function currentChange(session: Session): ResolvedChange {
  if (session.change === undefined) {
    throw new Error(NO_CHANGE_OPEN)
  }

  return session.change
}

function currentDraft(session: Session): Draft {
  if (session.draft === undefined) {
    throw new Error(NO_TREK_STARTED)
  }

  return session.draft
}

export async function open(session: Session, args: string[]): Promise<Outcome<ResolvedChange>> {
  const change = await changeFromArguments(session.cwd, args, session.cacheDir)

  return { session: { ...session, change, draft: undefined }, answer: change }
}

export function repoIn(session: Session, name: string): ResolvedRepo {
  return repoNamed(currentChange(session), name)
}

export function start(session: Session, header: TrekHeader): Outcome<undefined> {
  const draft = newDraft(currentChange(session), header)

  return { session: { ...session, draft, rejectedRounds: 0 }, answer: undefined }
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
  const { draft, problems } = await addSteps(currentDraft(session), steps)
  if (problems.length > 0) {
    return reject(session, problems)
  }

  return { session: { ...session, draft }, answer: [] }
}

export function draftStepIds(session: Session): string[] {
  return stepIds(currentDraft(session))
}

// The saved trek's path, or the error saying why the trek isn't valid; other failures throw.
async function saveOrInvalid(
  cwd: string,
  name: string,
  trek: Trek,
): Promise<{ path: string } | { invalid: TrekValidationError }> {
  try {
    return { path: await saveTrek(cwd, name, trek) }
  } catch (error) {
    if (error instanceof TrekValidationError) {
      return { invalid: error }
    }

    throw error
  }
}

/** What the agent may revise when it finishes a trek it updated. */
export type Revised = Readonly<{
  title?: string | undefined
  overview?: string | undefined
  outcome?: string | undefined
}>

// The draft with each revised part of its header in place of the one it had.
function revisedDraft(draft: Draft, revised: Revised): Draft {
  const given = Object.entries(revised).filter(([, value]) => value !== undefined)

  return { ...draft, header: { ...draft.header, ...Object.fromEntries(given) } }
}

/**
 * Saves the trek under `.srctrek/treks`, with its changed lines beside it, and any revised
 * title, overview, or outcome. A trek that fails the whole-trek rules is a rejected round, like
 * steps that fail theirs.
 */
export async function finish(
  session: Session,
  name: string,
  revised: Revised = {},
): Promise<Outcome<Finished>> {
  const draft = revisedDraft(currentDraft(session), revised)
  const trek = await draftToTrek(draft)

  const result = await saveOrInvalid(session.cwd, name, trek)
  if ("invalid" in result) {
    const rejected = reject(session, [result.invalid.message])
    return { session: rejected.session, answer: { problems: rejected.answer } }
  }

  return { session: { ...session, draft: undefined }, answer: { saved: result.path } }
}

/** How starting an update went: the old trek's steps in order, each to redo with why or kept. */
export type Updating = readonly UpdateStep[]

/**
 * Starts a draft from the saved trek `name`, carried over to the open change: its steps that
 * still hold, at the new commits, and those to redo.
 */
export async function update(session: Session, name: string): Promise<Outcome<Updating>> {
  const change = currentChange(session)
  const trek = await loadTrek(trekPath(session.cwd, name)).catch(() => undefined)
  if (trek === undefined) {
    throw new Error(`no valid saved trek named ${name}`)
  }

  const { draft, redo } = await carryOver(trek, change)
  const whyRedo = new Map(redo.map(({ step, why }) => [step.id, why]))
  const answer = trek.steps.map((step) => ({ step, why: whyRedo.get(step.id) }))

  return { session: { ...session, draft, rejectedRounds: 0 }, answer }
}

/**
 * Records the triggers found in code opened with plain --code, for the user to choose from:
 * where they were saved, or the problems with their evidence.
 */
export async function recordTriggers(session: Session, triggers: Trigger[]): Promise<Finished> {
  const change = currentChange(session)
  if (change.code === undefined || change.code.trigger !== undefined) {
    throw new Error("record_triggers is for code opened with --code and no trigger")
  }

  const problems = await triggerProblems(change, triggers)
  if (problems.length > 0) {
    return { problems }
  }

  return { saved: await saveTriggers(session.cwd, await trekNameFor(change), change, triggers) }
}

/**
 * How a proposal went: refused for its problems, or recorded, and opened when it could be, so
 * the trek goes on into it.
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
  const change = currentChange(session)
  const entry = { ...parseRepoEntry(source), name }
  try {
    const branches = await workBranches(session.cwd, change)
    const added = await withRouteRepo(session.cwd, change, entry, branches, session.cacheDir)
    const opened = repoNamed(added.change, name)

    return { session: widened(session, added.change), answer: { opened, readAt: added.readAt } }
  } catch (error) {
    const reason = errorText(error)
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
  const problems = await proposalProblems(currentChange(session), proposal)
  if (problems.length > 0) {
    return { session, answer: { problems } }
  }

  await saveProposal(session.cwd, proposal)
  if (proposal.source === undefined) {
    return { session, answer: { notOpened: "no source was given" } }
  }

  return openProposed(session, proposal.name, proposal.source)
}
