// Public API of @srctrek/core. Front-ends import only from here.
export {
  FORMAT_VERSION,
  TriggerKindSchema,
  SubmittedStepSchema,
  TrekHeaderSchema,
  TrekSchema,
  type Trek,
  type TrekHeader,
  type TrekStep,
} from "./schema/trek"
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
  PROTOCOL_VERSION,
  RequestParams,
  TRAIL_VERSION,
  isMethod,
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
} from "./treks"
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
export type { CodeTrek } from "./change/options"
export type { RangeHead } from "./change/head"
export { summarizeChange, type ChangeSummary, type ChangedRepoSummary } from "./change/summary"
export { worktreeStamp } from "./change/stamp"
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
  type UpdateStep,
} from "./prompts"
export { citationProblems } from "./build/citations"
export { completeStep, type SubmittedStep } from "./build/complete"
export { saveChangedLines } from "./build/changed-lines"
export {
  addSteps,
  draftToTrek,
  newDraft,
  stepIds,
  withChange,
  type Added,
  type Draft,
} from "./build/draft"
export { snapshotWorkingTree } from "./git/snapshot"
export { existingTrekFor } from "./build/existing"
export { trekNameFor } from "./build/name"
export type { UnreachableRepo } from "./build/reachable"
export { trekState, trekStates, type TrekState } from "./build/trek-state"
export {
  BUILD_LOG_ENV,
  BUILD_LOG_PREFIX,
  buildLogTail,
  buildSavedTrek,
  buildState,
  startBuild,
  type BuildState,
} from "./build/background"
export { trekStatus, type TrekStatus, type TriggerTrek } from "./build/status"
export { buildChangeTrek } from "./build/start"
export { checkAgent, type AgentCheck } from "./build/check"
export { loadTrekEntries, type TrekEntry } from "./trek-entries"
export { buildTrekPrompt } from "./guide"
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
