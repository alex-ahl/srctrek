import { describe, expect, test } from "bun:test"
import { buildProgress } from "../../../src/build/agent/progress"

const log = [
  "trek: opened web, api",
  "I'll trace the refund from the button.",
  "trek: read_file web src/refund.ts 1–end → 4238 chars",
  'trek: started "Refunding an order": add steps with add_steps',
  "trek: added s1, s2; the trek has s1, s2",
  "trek: nothing was added:",
  "trek: s3: cites api src/db.ts:88, which is blank",
  "trek: s4: from s2, but s2 makes no call on its lines",
  'trek: search api "refund(" in src → 685 chars',
  "trek: added s3; the trek has s1, s2, s3",
  "trek: saved /repo/.srctrek/treks/refunds.json",
]

describe("buildProgress", () => {
  test("reads what the agent read, the trek's title, its steps, rejected rounds, and its end", () => {
    expect(buildProgress(log)).toEqual({
      reads: [
        "opened web, api",
        "read_file web src/refund.ts 1–end → 4238 chars",
        'search api "refund(" in src → 685 chars',
      ],
      title: "Refunding an order",
      steps: ["s1", "s2", "s3"],
      rejected: [
        [
          "s3: cites api src/db.ts:88, which is blank",
          "s4: from s2, but s2 makes no call on its lines",
        ],
      ],
      saved: true,
      stopped: false,
    })
  })

  test("says when the user stopped it, and leaves out the agent's own lines", () => {
    const progress = buildProgress(["Working on it.", "trek: opened web", "trek: stopped"])

    expect(progress).toMatchObject({ reads: ["opened web"], stopped: true, steps: [] })
  })
})
