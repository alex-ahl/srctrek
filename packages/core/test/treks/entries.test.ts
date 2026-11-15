import { expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { loadTrekEntries, parseTrek, saveTrek, trekPath } from "../../src"
import { tempDir } from "../support/temp"

const fixturePath = join(import.meta.dir, "../fixtures/refund-trek.json")

test("summarises valid treks and keeps invalid ones with their problem", async () => {
  const root = await tempDir("treks-")
  await saveTrek(root, "refund", parseTrek(await Bun.file(fixturePath).json(), fixturePath))
  await writeFile(trekPath(root, "broken"), "{ not json")

  const entries = await loadTrekEntries(root)

  expect(entries.map((e) => e.name)).toEqual(["broken", "refund"])
  expect(entries[0]).toMatchObject({ valid: false })
  expect(entries[1]).toMatchObject({ valid: true, steps: 17, highFlags: 4 })
})
