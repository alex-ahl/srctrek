import type { Report } from "./report"

export function text(answer: string) {
  return { content: [{ type: "text" as const, text: answer }] }
}

// An answer the agent should act on before going further.
export function problem(answer: string) {
  return { ...text(answer), isError: true }
}

// "read_file api src/pay.ts 1–40 → 1210 chars": what was asked, and how much came back, which
// the agent carries from then on. The build log shows a build's reading as it happens.
export function answered(report: Report, asked: string) {
  return async (answer: string) => {
    await report(`${asked} → ${answer.length} chars`)
    return text(answer)
  }
}
