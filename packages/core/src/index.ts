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
} from "./prompts"
export { citationProblems } from "./build/citations"
export { completeStep, type SubmittedStep } from "./build/complete"
export { saveChangedLines } from "./build/changed-lines"
export { addSteps, draftToTour, newDraft, stepIds, type Added, type Draft } from "./build/draft"
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
