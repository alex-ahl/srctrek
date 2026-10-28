import { expireCarts } from "./expire-carts"
import { sendDigests } from "./send-digests"

// Jobs by the name the schedule uses.
const JOBS: Record<string, () => Promise<void>> = {
  "expire-carts": expireCarts,
  "send-digests": sendDigests,
}

export async function runJob(name: string): Promise<void> {
  const job = JOBS[name]
  if (!job) throw new Error(`unknown job ${name}`)
  await job()
}
