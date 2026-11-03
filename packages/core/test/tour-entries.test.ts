import { expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { loadTourEntries, parseTour, saveTour, tourPath } from "../src"
import { tempDir } from "./support/temp"

const fixturePath = join(import.meta.dir, "fixtures/refund-tour.json")

test("summarises valid tours and keeps invalid ones with their problem", async () => {
  const root = await tempDir("tours-")
  await saveTour(root, "refund", parseTour(await Bun.file(fixturePath).json(), fixturePath))
  await writeFile(tourPath(root, "broken"), "{ not json")

  const entries = await loadTourEntries(root)

  expect(entries.map((e) => e.name)).toEqual(["broken", "refund"])
  expect(entries[0]).toMatchObject({ valid: false })
  expect(entries[1]).toMatchObject({ valid: true, steps: 17, highFlags: 4 })
})
