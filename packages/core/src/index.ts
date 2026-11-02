// Public API of @codetrail/core. Front-ends import only from here.
export {
  FORMAT_VERSION,
  TriggerKindSchema,
  SubmittedStepSchema,
  TourHeaderSchema,
  TourSchema,
  type Tour,
  type TourHeader,
  type TourStep,
} from "./schema/tour"
export { callStacks, type CallStacks } from "./schema/stacks"
export { currentStep, openSession, type Position, type SteppingSession } from "./session/session"
export {
  enteredFrom,
  stepBack,
  stepInto,
  stepNext,
  stepOut,
  stepOver,
  stepTo,
} from "./session/moves"
export type { RunningFunctions } from "./session/functions"
export {
  sessionView,
  type EndView,
  type Frame,
  type OverviewView,
  type SessionView,
  type StepRef,
  type StepView,
  type ViewContext,
} from "./session/view"
export { UnreachableRepoError, viewContext } from "./session/context"
export {
  ErrorCode,
  PROTOCOL_VERSION,
  RequestParams,
  TRAIL_VERSION,
  isMethod,
  versionMismatch,
  type InitializeResult,
  type Method,
} from "./protocol/messages"
export {
  TOURS_DIR,
  TourValidationError,
  listTours,
  loadTour,
  parseTour,
  saveTour,
  tourPath,
} from "./tours"
export { detectBase } from "./git/base"
export { parseRange, resolveRange, type RangeSpec, type ResolvedRange } from "./git/range"
export { GitError, runGit } from "./git/run"
export {
  changedFiles,
  changedLines,
  parseChangedLines,
  type FileChange,
  type LineChange,
} from "./git/diff"
export { blobAt, readFileAt } from "./git/read"
export {
  findRepoEntry,
  folderName,
  isRemote,
  parseRepoEntry,
  repoName,
  type RepoEntry,
} from "./repos/entry"
export { REPOS_LIST, parseReposList, readReposList } from "./repos/list"
export {
  resolvePullRequest,
  resolveRangeChange,
  resolveUnchangedRepo,
  type ChangedRepo,
  type UnchangedRepo,
} from "./repos/resolve"
export { parsePullRequestUrl, type PullRequest } from "./repos/pull-request"
export { cachePath, cachedRepo, defaultCacheDir, fetchRefs, fetchRevision } from "./repos/cache"
export { editorCheckout } from "./repos/worktree"
export { readChangeArguments, type ChangeArguments, type ChangeSource } from "./change/arguments"
export type { CodeTour } from "./change/options"
export {
  hasRange,
  resolveChange,
  withRouteRepo,
  type ReadAt,
  type RepoWithRange,
  type ResolvedChange,
  type ResolvedRepo,
} from "./change/resolve"
export { changeFiles, changePatch, type ChangedFiles, type Patch } from "./read/diff"
export { listFiles, readLines, type Listing, type NumberedLines } from "./read/files"
export { describeRepo, repoNamed } from "./read/repo"
export { search, type Match, type SearchResult } from "./read/search"
export { directoryIn } from "./files"
export {
  BUILD_STOPPED,
  PROMPT_HASH,
  SERVER_INSTRUCTIONS,
  TOOL_DESCRIPTIONS,
  headlessBuildPrompt,
  type BuildMode,
  proposalOpenedAnswer,
  proposalUnopenedAnswer,
  updateStartedAnswer,
  type UpdateStep,
} from "./prompts"
export { citationProblems } from "./build/citations"
export { completeStep, type SubmittedStep } from "./build/complete"
export { saveChangedLines } from "./build/changed-lines"
export {
  addSteps,
  draftToTour,
  newDraft,
  stepIds,
  withChange,
  type Added,
  type Draft,
} from "./build/draft"
export { snapshotWorkingTree } from "./git/snapshot"
export { existingTourFor } from "./build/existing"
export { tourNameFor } from "./build/name"
export {
  BUILD_LOG_ENV,
  BUILD_LOG_PREFIX,
  buildLogTail,
  buildSavedTour,
  buildState,
  startBuild,
  type BuildState,
} from "./build/background"
export { tourStatus, type TourStatus, type TriggerTour } from "./build/status"
export { buildTourPrompt } from "./guide"
export { buildFiles, type BuildFiles } from "./build/files"
export {
  TRIGGERS_DIR,
  TriggerSchema,
  loadTriggers,
  saveTriggers,
  triggerProblems,
  triggersPath,
  type Trigger,
} from "./build/triggers"
export {
  PROPOSED_REPOS,
  ProposedRepoSchema,
  acceptProposal,
  dismissProposal,
  loadProposals,
  proposalProblems,
  saveProposal,
  type ProposedRepo,
} from "./build/proposals"
export { nearbyRepos, type Nearby, type NearbyRepo } from "./repos/nearby"
export { workBranches } from "./repos/branch"
export { carryOver, type CarriedOver, type Redo } from "./build/carry"
