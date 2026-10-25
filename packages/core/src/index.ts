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
export { isRemote, parseRepoEntry, type RepoEntry } from "./repos/entry"
export { REPOS_LIST, parseReposList, readReposList } from "./repos/list"
export { resolveUnchangedRepo, type UnchangedRepo } from "./repos/resolve"
