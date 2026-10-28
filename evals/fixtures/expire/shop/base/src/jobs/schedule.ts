import { runJob } from "./index"

// [minute hour, job]: each job runs once a day at that time.
const SCHEDULE: [string, string][] = [
  ["0 3", "expire-carts"],
  ["30 4", "send-digests"],
]

function isDue(when: string, now: Date): boolean {
  const [minute, hour] = when.split(" ").map(Number)
  return now.getMinutes() === minute && now.getHours() === hour
}

export function startScheduler(): void {
  setInterval(() => {
    const now = new Date()
    for (const [when, job] of SCHEDULE) {
      if (isDue(when, now)) void runJob(job)
    }
  }, 60_000)
}
