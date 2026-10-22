import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const QUEUE_DIR = process.env.QUEUE_DIR ?? "/var/lib/shop/queue"

// One JSON line per message, in a file per topic; consumers keep their own offsets.
export function publish(topic: string, payload: Record<string, unknown>): void {
  mkdirSync(QUEUE_DIR, { recursive: true })
  const message = { topic, sent_at: new Date().toISOString(), payload }
  appendFileSync(join(QUEUE_DIR, `${topic}.jsonl`), JSON.stringify(message) + "\n")
}
