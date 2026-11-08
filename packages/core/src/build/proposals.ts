import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import type { ResolvedChange } from "../change/resolve"
import { REPOS_LIST } from "../repos/list"
import { placeProblem } from "./citations"

/**
 * A repo the route leads into that the change doesn't include, proposed by the agent: the
 * name the code calls it by, where git can get it when the agent found out, and the lines that
 * show the route goes there. Only the user adds it to the repos list, giving its location when
 * the agent couldn't.
 */
export const ProposedRepoSchema = z.object({
  name: z.string().regex(/^[\w.-]+$/, "a name of letters, digits, '.', '_' and '-'"),
  source: z.string().min(1).optional(),
  reason: z.string().min(1),
  evidence: z
    .array(
      z.object({
        repo: z.string().min(1),
        file: z.string().min(1),
        line: z.number().int().positive(),
      }),
    )
    .min(1),
})

export type ProposedRepo = z.infer<typeof ProposedRepoSchema>

export const PROPOSED_REPOS = join(".srctrek", "proposed-repos.json")

/** Why `proposal` can't be recorded: its name is taken, or its evidence doesn't hold. */
export async function proposalProblems(
  change: ResolvedChange,
  proposal: ProposedRepo,
): Promise<string[]> {
  if (change.repos.some((repo) => repo.name === proposal.name)) {
    return [`${proposal.name} is already on the route`]
  }

  const problems = await Promise.all(
    proposal.evidence.map((cite) => placeProblem(change, { ...cite, how: "cites" })),
  )

  return problems.filter((problem) => problem !== undefined)
}

/** The repos proposed in `root` and not yet added or dismissed. */
export async function loadProposals(root: string): Promise<ProposedRepo[]> {
  try {
    const text = await readFile(join(root, PROPOSED_REPOS), "utf8")
    const parsed = z.array(ProposedRepoSchema).safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

async function writeProposals(root: string, proposals: ProposedRepo[]): Promise<void> {
  await mkdir(join(root, ".srctrek"), { recursive: true })
  await writeFile(join(root, PROPOSED_REPOS), JSON.stringify(proposals, null, 2) + "\n")
}

/** Records `proposal`, replacing an earlier one by the same name. */
export async function saveProposal(root: string, proposal: ProposedRepo): Promise<string> {
  const others = (await loadProposals(root)).filter(({ name }) => name !== proposal.name)
  await writeProposals(root, [...others, proposal])

  return join(root, PROPOSED_REPOS)
}

/** Drops the proposal named `name`. */
export async function dismissProposal(root: string, name: string): Promise<void> {
  const others = (await loadProposals(root)).filter((proposal) => proposal.name !== name)
  await writeProposals(root, others)
}

// A list written by hand may not end with a newline; the new line mustn't join its last.
async function lineStart(path: string): Promise<string> {
  const text = await readFile(path, "utf8").catch(() => "")

  return text === "" || text.endsWith("\n") ? "" : "\n"
}

/**
 * Adds the proposal named `name` to the repos list, under its name, at `source` when the
 * user gives one, else where the agent found it; then drops the proposal.
 */
export async function acceptProposal(root: string, name: string, source?: string): Promise<void> {
  const proposal = (await loadProposals(root)).find((candidate) => candidate.name === name)
  if (proposal === undefined) {
    throw new Error(`no proposed repo named ${name}`)
  }

  const location = source?.trim() || proposal.source
  if (location === undefined) {
    throw new Error(`say where ${name} lives: a path or a URL`)
  }

  const list = join(root, REPOS_LIST)
  await mkdir(join(root, ".srctrek"), { recursive: true })
  await appendFile(list, `${await lineStart(list)}${proposal.name} = ${location}\n`)
  await dismissProposal(root, name)
}
