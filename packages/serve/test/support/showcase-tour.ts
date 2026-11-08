import type { SubmittedStep } from "@codetrail/core"
import { repoWithSteps } from "./pay-tour"

// A small refund flow whose tour, "pay", uses everything an editor shows: predicted values (an
// argument, an assignment, a return, a doubtful one), a flag of each severity, a step with two
// calls, a guessed link, context, a question, a hop that starts a stack of its own, and a file the
// change edits rather than adds.
const BEFORE: [string, string][] = [
  [
    "payments.ts",
    "export function charge(orderId, amount) {\n  return provider.charge(orderId, amount)\n}\n",
  ],
]

const FILES: [string, string][] = [
  ["types.ts", "export type Refund = { orderId: string; amount: number }\n"],
  [
    "payments.ts",
    "export function charge(orderId, amount) {\n  // the provider isn't wired up yet\n  return { orderId, amount }\n}\n",
  ],
  [
    "events.ts",
    "const queue = []\nexport function publish(name, id) {\n  queue.push({ name, id })\n}\n",
  ],
  ["mailer.ts", "export function onRefunded(event) {\n  sendMail(event.id)\n}\n"],
  [
    "refund.ts",
    [
      'import { charge } from "./payments"',
      'import { publish } from "./events"',
      "export function refund(orderId, amount) {",
      "  const result = charge(orderId, -amount)",
      '  publish("refunded", orderId)',
      "  return result",
      "}",
      "",
    ].join("\n"),
  ],
  [
    "routes.ts",
    [
      'import { refund } from "./refund"',
      "export function onRefundRequest(req) {",
      "  const amount = req.body.amount",
      "  return refund(req.orderId, amount)",
      "}",
      "",
    ].join("\n"),
  ],
]

export function repoWithShowcase(): Promise<string> {
  return repoWithSteps(
    FILES,
    ({ step, cites }) => {
      const steps: SubmittedStep[] = [
        step({
          file: "routes.ts",
          start_line: 2,
          end_line: 5,
          name: "POST /refunds",
          summary:
            "A refund request arrives and the route hands its order and amount to refund. Nothing checks the amount on the way in.",
          details: "The amount comes straight from the request body.",
          predicted_values: [{ name: "amount", value: "40", line: 3, role: "assignment" }],
          uncertain: { severity: "low", note: "the amount isn't validated" },
        }),
        step({
          id: "s2",
          file: "refund.ts",
          start_line: 3,
          end_line: 7,
          name: "refund",
          summary:
            "refund charges the order a negative amount, then publishes a refunded event for whoever listens, and returns the charge.",
          details: "Two calls leave here: the charge, then the event.",
          from: "s1",
          via: cites("routes.ts", 4),
          predicted_values: [
            { name: "orderId", value: '"o-1"', line: 3, role: "argument" },
            {
              name: "result",
              value: '{ orderId: "o-1", amount: -40 }',
              line: 4,
              role: "assignment",
              uncertain: true,
            },
          ],
          uncertain: {
            severity: "high",
            note: "a negative charge stands in for a refund the provider may reject",
          },
          notes: [
            {
              question: "Why a negative charge?",
              answer: "The payments module has no refund call yet.",
            },
          ],
        }),
        step({
          id: "s2a",
          kind: "context",
          file: "types.ts",
          start_line: 1,
          end_line: 1,
          name: "Refund",
          summary: "The shape a refund takes, which the amount should match.",
          for: "s2",
          via: cites("refund.ts", 3),
        }),
        step({
          id: "s3",
          file: "payments.ts",
          start_line: 1,
          end_line: 4,
          name: "charge",
          summary:
            "charge returns the order and amount it was given, as a stand-in for the provider's answer.",
          from: "s2",
          via: cites("refund.ts", 4),
          predicted_values: [
            { name: "charge", value: '{ orderId: "o-1", amount: -40 }', line: 3, role: "return" },
          ],
        }),
        step({
          id: "s4",
          file: "events.ts",
          start_line: 2,
          end_line: 4,
          name: "publish",
          summary:
            "publish puts the event on an in-memory queue, matched to the call in refund by its name alone.",
          from: "s2",
          via: { ...cites("refund.ts", 5), guessed: true },
          uncertain: {
            severity: "medium",
            note: "the queue lives in memory, so a restart drops events",
          },
        }),
        step({
          id: "s5",
          kind: "hop",
          file: "mailer.ts",
          start_line: 1,
          end_line: 3,
          name: "onRefunded",
          summary:
            "Later, the mailer takes the event off the queue and mails the customer. Nobody waits for it.",
          from: "s4",
          via: cites("events.ts", 3),
        }),
      ]
      return steps
    },
    BEFORE,
  )
}
