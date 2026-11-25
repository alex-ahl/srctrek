// Makes a set of repos busy enough to see trek's landing page as it is in use, and prints how to
// open it:
//   bun scripts/example-repo.ts [folder]
//
// In the folder (by default trek-example in the system's temp folder, made afresh each run):
// web, the repo trek runs in, on feature/refunds with a trek and work not yet committed, beside
// branches with treks ready, stale, or none, and two treks whose work is done, one merged and one
// whose branch is gone; api, worker, and docs beside it, api with work on a branch of its own;
// and bin/gh, a stand-in for GitHub's CLI that lists five pull requests, two waiting on review.
import { chmod, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { addSteps, draftToTrek, newDraft, runGit, saveTrek, trekStatus } from "../packages/core/src"
import { changeOf } from "../packages/testing/src"

// Commits need an identity, and a machine may have none configured.
const IDENTITY = ["-c", "user.name=Sam Example", "-c", "user.email=sam@example.test"]

type Commit = readonly [file: string, content: string, message: string]

async function commitAs(dir: string, [file, content, message]: Commit): Promise<void> {
  await mkdir(dirname(join(dir, file)), { recursive: true })
  await writeFile(join(dir, file), content)
  await runGit(dir, ["add", file])
  await runGit(dir, [...IDENTITY, "commit", "--quiet", "-m", message])
}

async function repo(dir: string, commits: readonly Commit[]): Promise<string> {
  await mkdir(dir, { recursive: true })
  await runGit(dir, ["init", "--quiet", "--initial-branch=main"])
  for (const each of [
    ["README.md", `# ${dir.split("/").at(-1)}\n`, "Start"] as const,
    ...commits,
  ]) {
    await commitAs(dir, each)
  }

  return dir
}

// A branch off main with `commits` on it; the repo is left on main.
async function branch(dir: string, name: string, commits: readonly Commit[]): Promise<string> {
  await runGit(dir, ["switch", "--quiet", "-c", name, "main"])
  for (const each of commits) {
    await commitAs(dir, each)
  }

  const tip = await runGit(dir, ["rev-parse", "HEAD"])
  await runGit(dir, ["switch", "--quiet", "main"])
  return tip
}

// Saves a one-step trek of `range` under the name trek gives it, as an agent would.
async function saveTrekOf(dir: string, range: string, title: string): Promise<void> {
  const change = await changeOf(dir, range)
  const header = {
    title,
    overview: `${title}, from the request to what it leaves behind.`,
    trigger: { kind: "request" as const, input: "POST /refunds" },
    outcome: "the order refunded",
    sources: [],
    author: { model: "example" },
  }
  const step = {
    id: "s1",
    repo: change.repos[0]?.name ?? "",
    file: "app.ts",
    start_line: 1,
    end_line: 1,
    kind: "call" as const,
    summary: "the app starts",
    details: "where every request comes in",
    via: null,
  }
  const { draft, problems } = await addSteps(newDraft(change, header), [step])
  if (problems.length > 0) {
    throw new Error(`the example trek of ${range}: ${problems.join("; ")}`)
  }

  await saveTrek(dir, (await trekStatus(dir, change)).name, await draftToTrek(draft))
}

const lines = (...each: string[]) => `${each.join("\n")}\n`

async function web(dir: string) {
  await repo(dir, [
    ["app.ts", lines("export function start() {", "  return 'shop'", "}"), "Add the app"],
    ["src/orders.ts", lines("export const orders = []"), "List orders"],
    ["src/refunds.ts", lines("export function refund() {}"), "Stub refunds"],
  ])

  const tips = {
    refunds: await branch(dir, "feature/refunds", [
      ["src/refunds.ts", lines("export function refund(amount: number) {}"), "Take an amount"],
      ["src/refunds.ts", lines("export function refund(amount: number) {", "}"), "Refund"],
      ["src/ledger.ts", lines("export const ledger = []"), "Add a ledger"],
      ["src/ledger.ts", lines("export const ledger: number[] = []"), "Type the ledger"],
      ["src/notify.ts", lines("export function notify() {}"), "Notify on refund"],
      ["app.ts", lines("export function start() {", "  return 'shop, with refunds'", "}"), "Wire"],
      ["src/refunds.test.ts", lines("// refunds"), "Test refunds"],
      [
        "src/refunds.ts",
        lines("export function refund(amount: number) {", "  return amount", "}"),
        "Return it",
      ],
      ["docs/refunds.md", lines("# Refunds"), "Document refunds"],
    ]),
    partial: await branch(dir, "feature/partial-refunds", [
      ["src/partial.ts", lines("export const part = 0.5"), "Refund part of an order"],
      ["src/partial.ts", lines("export const part = 0.25"), "A quarter"],
      ["src/partial.test.ts", lines("// partial"), "Test partial refunds"],
      ["app.ts", lines("export function start() {", "  return 'shop, in part'", "}"), "Wire"],
      ["docs/partial.md", lines("# Partial"), "Document partial refunds"],
    ]),
    rounding: await branch(dir, "fix/rounding", [
      ["src/money.ts", lines("export const round = Math.round"), "Round to cents"],
    ]),
    gift: await branch(dir, "feature/gift-cards", [
      ["src/gift.ts", lines("export const gift = 'card'"), "Add gift cards"],
      ["src/gift.ts", lines("export const gift = 'gift card'"), "Name them"],
      ["src/gift.test.ts", lines("// gift"), "Test gift cards"],
    ]),
    ledger: await branch(dir, "spike/ledger", [
      ["src/ledger.ts", lines("export const ledger = new Map()"), "Try a map"],
      ["src/ledger.ts", lines("export const ledger = new Set()"), "Try a set"],
    ]),
    deps: await branch(dir, "chore/bump-deps", [
      ["package.json", lines('{ "name": "web" }'), "Bump dependencies"],
    ]),
    search: await branch(dir, "feature/search", [
      ["src/search.ts", lines("export const search = ''"), "Search orders"],
      ["src/search.ts", lines("export const search = 'orders'"), "By order"],
      ["src/search.ts", lines("export const search = 'customers'"), "By customer"],
      ["src/search.test.ts", lines("// search"), "Test search"],
    ]),
  }
  await branch(dir, "feature/coupons", [
    ["src/coupons.ts", lines("export const coupon = 'TEN'"), "Apply a coupon"],
  ])
  await branch(dir, "feature/old-export", [
    ["src/export.ts", lines("export const csv = true"), "Export orders as CSV"],
  ])

  // treks: ready on the branch checked out and on gift cards; stale on partial refunds, which
  // moved on after its trek; done for coupons, merged since, and the old export, its branch gone
  await saveTrekOf(dir, "main...feature/refunds", "Refunding an order")
  await saveTrekOf(dir, "main...feature/gift-cards", "Paying with a gift card")
  await saveTrekOf(dir, "main...feature/partial-refunds", "Refunding part of an order")
  await saveTrekOf(dir, "main...feature/coupons", "Applying a coupon")
  await saveTrekOf(dir, "main...feature/old-export", "Exporting orders")
  await runGit(dir, ["switch", "--quiet", "feature/partial-refunds"])
  await commitAs(dir, [
    "app.ts",
    lines("export function start() {", "  return 'partly'", "}"),
    "Rename",
  ])
  await runGit(dir, ["switch", "--quiet", "main"])
  await runGit(dir, [
    ...IDENTITY,
    "merge",
    "--quiet",
    "--no-ff",
    "-m",
    "Merge coupons",
    "feature/coupons",
  ])
  await runGit(dir, ["branch", "--quiet", "-D", "feature/old-export"])

  // the user's own branch, with work not yet committed
  await runGit(dir, ["switch", "--quiet", "feature/refunds"])
  await writeFile(
    join(dir, "src/refunds.ts"),
    lines("export function refund(amount: number) {", "  return -amount", "}"),
  )
  await writeFile(join(dir, "src/receipt.ts"), lines("export const receipt = ''"))
  await writeFile(join(dir, "src/ledger.ts"), lines("export const ledger: bigint[] = []"))

  return tips
}

// A stand-in for gh: five open pull requests on branches of web, two waiting on the user's review.
async function fakeGh(bin: string, tips: Readonly<Record<string, string>>) {
  const now = Date.now()
  const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString()
  const pr = (
    number: number,
    title: string,
    author: string,
    head: string,
    hours: number,
    draft = false,
  ) => ({
    number,
    title,
    author: { login: author },
    url: `https://github.com/example/web/pull/${number}`,
    isDraft: draft,
    headRefOid: head,
    baseRefName: "main",
    updatedAt: hoursAgo(hours),
    commits: [{}, {}],
  })
  const listed = [
    pr(12, "Refund part of an order", "alice", tips.partial ?? "", 2),
    pr(15, "Pay with a gift card", "bo", tips.gift ?? "", 26),
    pr(17, "Round refunds to cents", "chen", tips.rounding ?? "", 50),
    pr(19, "Search orders by customer", "dana", tips.search ?? "", 4, true),
    pr(21, "Bump dependencies", "bot", tips.deps ?? "", 120),
  ]
  const script = lines(
    "#!/bin/sh",
    'case "$*" in',
    `  *review-requested*) echo '[{"number":12},{"number":15}]' ;;`,
    `  "pr view"*) echo '{"title":"Refund part of an order","author":{"login":"alice"},"isDraft":false}' ;;`,
    `  *) echo '${JSON.stringify(listed)}' ;;`,
    "esac",
  )
  await mkdir(bin, { recursive: true })
  await writeFile(join(bin, "gh"), script)
  await chmod(join(bin, "gh"), 0o755)
}

const folder = resolve(process.argv[2] ?? join(tmpdir(), "trek-example"))
await rm(folder, { recursive: true, force: true })
await mkdir(folder, { recursive: true })

const tips = await web(join(folder, "web"))
await repo(join(folder, "api"), [["server.ts", lines("export const port = 3000"), "Serve"]])
await branch(join(folder, "api"), "refunds-api", [
  ["refunds.ts", lines("export const route = '/refunds'"), "Route refunds"],
  ["refunds.ts", lines("export const route = '/v1/refunds'"), "Version it"],
  ["ledger.ts", lines("export const post = true"), "Post to the ledger"],
  ["refunds.test.ts", lines("// refunds"), "Test the route"],
])
await runGit(join(folder, "api"), ["switch", "--quiet", "refunds-api"])
await repo(join(folder, "worker"), [["jobs.ts", lines("export const jobs = []"), "Queue jobs"]])
await repo(join(folder, "docs"), [["index.md", lines("# Docs"), "Start the docs"]])
await fakeGh(join(folder, "bin"), tips)

const trek = resolve(import.meta.dir, "../dist/trek")
console.log(`made ${folder}`)
console.log(`open it:  cd ${join(folder, "web")} && PATH="${join(folder, "bin")}:$PATH" ${trek}`)
