/** A pull request as git sees it: the repo to clone and the ref its head can be fetched from. */
export type PullRequest = {
  url: string
  name: string
  cloneUrl: string
  number: number
  ref: string
}

// What a host puts between the repo and the pull request number in its URLs, and the ref it
// publishes for that number. Matched on the path, not the host name, so self-hosted
// instances work the same.
type Shape = { marker: string; ref: (n: number) => string }

const SHAPES: Shape[] = [
  { marker: "/pull/", ref: (n) => `refs/pull/${n}/head` },
  { marker: "/-/merge_requests/", ref: (n) => `refs/merge-requests/${n}/head` },
]

type Match = { repoPath: string; number: number; ref: string }

// "/acme/payments/pull/12/files" splits into "/acme/payments" and "12/files".
function matchShape(path: string, { marker, ref }: Shape): Match | undefined {
  const [repoPath = "", afterMarker] = path.split(marker)
  if (afterMarker === undefined) {
    return undefined
  }

  const hasOwnerAndRepo = repoPath.split("/").filter(Boolean).length >= 2
  const number = Number(afterMarker.split("/")[0])
  if (!hasOwnerAndRepo || !Number.isInteger(number) || number < 1) {
    return undefined
  }

  return { repoPath, number, ref: ref(number) }
}

/** The pull request a URL points to; undefined when it isn't a pull request URL. */
export function parsePullRequestUrl(text: string): PullRequest | undefined {
  const url = URL.parse(text)
  if (url === null || !["http:", "https:"].includes(url.protocol)) {
    return undefined
  }

  const match = SHAPES.map((shape) => matchShape(url.pathname, shape)).find(Boolean)
  if (match === undefined) {
    return undefined
  }

  const { repoPath, number, ref } = match
  return {
    url: text,
    name: repoPath.split("/").at(-1) ?? "",
    cloneUrl: `${url.origin}${repoPath}.git`,
    number,
    ref,
  }
}

/** Which pull request a ref is the head of: "refs/pull/12/head" is pull 12; other refs, none. */
export function pullRequestOfRef(
  ref: string,
): { kind: "pull" | "merge-requests"; number: number } | undefined {
  const [, kind, number] = /^refs\/(pull|merge-requests)\/(\d+)\//.exec(ref) ?? []
  if (kind === undefined || number === undefined) {
    return undefined
  }

  return { kind: kind === "pull" ? "pull" : "merge-requests", number: Number(number) }
}
