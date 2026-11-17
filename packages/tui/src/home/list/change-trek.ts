import type { TrekStatus } from "@srctrek/core"

/**
 * Whether the change's status is about the saved trek `name`: its own trek. A change with no
 * commits has none, so a trek saved earlier under its name is just a trek, standing as its own
 * state says.
 */
export function isChangeTrek(name: string, status: TrekStatus | undefined): boolean {
  return status !== undefined && status.kind !== "empty" && status.name === name
}
