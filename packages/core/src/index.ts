// Public API of @srctrek/core. Front-ends import only from here.
export {
  FORMAT_VERSION,
  SeveritySchema,
  TriggerKindSchema,
  SubmittedStepSchema,
  TrekHeaderSchema,
  TrekSchema,
  type Severity,
  type Trek,
  type TrekHeader,
  type TrekStep,
} from "./schema/trek"
export { flagCounts } from "./schema/flags"
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
  type Call,
  type CameFrom,
  type Cite,
  type EndView,
  type FlaggedStep,
  type Frame,
  type Moves,
  type MoveTarget,
  type NextStop,
  type OverviewView,
  type OwnCheckout,
  type SessionView,
  type StepRef,
  type StepView,
  type ViewContext,
} from "./session/view"
export { UnreachableRepoError, viewContext } from "./session/context"
export { firstStopPlace, type StopPlace } from "./session/start"
export {
  agentSetting,
  loadSettings,
  saveSetting,
  settingsPath,
  type SettingSource,
  type Settings,
} from "./settings"
export {
  ErrorCode,
  InvalidParams,
  PROTOCOL_VERSION,
  RequestParams,
  SRCTREK_VERSION,
  isMethod,
  parseParams,
  versionMismatch,
  type BuildResult,
  type InitializeResult,
  type LogResult,
  type Method,
  type TreksResult,
} from "./protocol/messages"
export {
  TREKS_DIR,
  TrekValidationError,
  listTreks,
  loadTrek,
  parseTrek,
  saveTrek,
  trekPath,
} from "./treks/store"
export { baseName, detectBase } from "./git/base"
export { parseRange, resolveRange, type RangeSpec, type ResolvedRange } from "./git/range"
export { GitError, runGit } from "./git/run"
export { rangeCommits } from "./schema/recorded-range"
export {
  changedFiles,
  changedLines,
  parseChangedLines,
  type FileChange,
  type LineChange,
} from "./git/diff"
export { blobAt, readFileAt } from "./git/read"
export { folderName, isRemote, parseRepoEntry, type RepoEntry } from "./repos/entry"
export { REPOS_LIST, readReposList } from "./repos/list"
export {
  resolvePullRequest,
  resolveRangeChange,
  resolveUnchangedRepo,
  type ChangedRepo,
  type UnchangedRepo,
} from "./repos/resolve"
export { parsePullRequestUrl, type PullRequest } from "./repos/pull-request"
export {
  openPullRequests,
  pullRequestOf,
  type OpenPullRequest,
  type PullRequestDetails,
} from "./repos/open-pull-requests"
export { fetchRepo, repoBranches, type RepoBranch, type RepoBranches } from "./repos/branches"
export { cachedRepo, defaultCacheDir, fetchRefs, fetchRevision } from "./repos/cache"
export { editorCheckout } from "./repos/worktree"
export { readChangeArguments, type ChangeArguments, type ChangeSource } from "./change/arguments"
export type { CodeTrek } from "./change/options"
export type { RangeHead } from "./change/head"
export {
  findsWaysIn,
  summarizeChange,
  type ChangeSummary,
  type ChangedRepoSummary,
} from "./change/summary"
export { worktreeStamp } from "./change/stamp"
export {
  branchChoices,
  choiceArguments,
  choiceOfArguments,
  type BranchChoice,
  type OtherBranch,
  type BranchChoices,
  type ChangeChoice,
  type RepoPick,
} from "./change/choices"
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
  SET_AGENT_COMMAND,
  SETUP_REQUEST,
  agentSavedAnswer,
  agentUnsavedAnswer,
  SERVER_INSTRUCTIONS,
  TOOL_DESCRIPTIONS,
  headlessBuildPrompt,
  type BuildMode,
  proposalOpenedAnswer,
  proposalUnopenedAnswer,
  updateStartedAnswer,
  CUT_NOTES,
  NO_CHANGE_OPEN,
  NO_TREK_STARTED,
  linesPartNote,
  patchCutNote,
  trekStartedAnswer,
  type UpdateStep,
} from "./prompts/texts"
export { citationProblems } from "./build/draft/citations"
export { completeStep, type SubmittedStep } from "./build/draft/complete"
export {
  addSteps,
  draftToTrek,
  newDraft,
  stepIds,
  withChange,
  type Added,
  type Draft,
} from "./build/draft/draft"
export { snapshotWorkingTree } from "./git/snapshot"
export { existingTrekFor } from "./build/status/existing"
export { trekNameFor } from "./build/status/name"
export type { UnreachableRepo } from "./build/status/reachable"
export { trekStates, type TrekState } from "./build/status/trek-state"
export {
  BUILD_LOG_ENV,
  BUILD_LOG_PREFIX,
  buildLogTail,
  buildSavedTrek,
  buildState,
  startBuild,
  stopBuild,
  type BuildState,
} from "./build/agent/background"
export { buildProgress, buildTimes, type BuildProgress } from "./build/agent/progress"
export { buildDraftSteps, writeBuildDraft, type DraftStep } from "./build/agent/draft-file"
export { buildHistory, readBuild, type BuildRecord, type BuildRef } from "./build/agent/history"
export {
  pullRequestStatus,
  trekStatus,
  type TrekStatus,
  type TriggerTrek,
} from "./build/status/status"
export { buildChangeTrek } from "./build/agent/start"
export { checkAgent, type AgentCheck } from "./build/agent/check"
export { loadTrekEntries, type TrekEntry } from "./treks/entries"
export { buildTrekPrompt } from "./prompts/guide"
export { buildFiles, type BuildFiles } from "./build/agent/files"
export {
  TriggerSchema,
  loadTriggers,
  saveTriggers,
  triggerProblems,
  type Trigger,
} from "./build/triggers"
export {
  ProposedRepoSchema,
  acceptProposal,
  dismissProposal,
  loadProposals,
  proposalProblems,
  saveProposal,
  type ProposedRepo,
} from "./build/proposals"
export {
  nearbyCheckouts,
  nearbyRepos,
  type Nearby,
  type NearbyCheckout,
  type NearbyRepo,
} from "./change/nearby"
export { workBranches } from "./change/work-branches"
export { carryOver, type CarriedOver, type Redo } from "./build/draft/carry"
export { errorText } from "./error-text"
export { changeFromArguments } from "./change/from-arguments"
export { choiceStatus } from "./build/status/choice-status"
