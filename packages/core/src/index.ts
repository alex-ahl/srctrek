// Public API of @codetrail/core. Front-ends import only from here.
export { FORMAT_VERSION, TourSchema, type Tour, type TourStep } from "./schema/tour"
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
export { cachePath, cachedRepo, defaultCacheDir, fetchRefs } from "./repos/cache"
export { editorCheckout } from "./repos/worktree"
export { readChangeArguments, type ChangeArguments, type ChangeSource } from "./change/arguments"
export { resolveChange, type ResolvedChange, type ResolvedRepo } from "./change/resolve"
export { changeFiles, changePatch } from "./read/diff"
export { listFiles, readLines, type NumberedLines } from "./read/files"
export { describeRepo, repoNamed } from "./read/repo"
export { search, type Match, type SearchResult } from "./read/search"
export { directoryIn } from "./files"
export { TOOL_DESCRIPTIONS } from "./prompts"
export { citationProblems } from "./build/citations"
export { completeStep, type SubmittedStep } from "./build/complete"
