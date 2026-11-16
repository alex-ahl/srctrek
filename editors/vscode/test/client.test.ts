import { afterEach, expect, test } from "bun:test"
import { join } from "node:path"
import { TrekClient } from "../src/client"
import { statusText } from "../src/step-text"
import { repoWithShowcase, repoWithTrek } from "@srctrek/testing"

const TREK = join(import.meta.dir, "../../../packages/cli/src/main.ts")

let client: TrekClient | undefined

afterEach(() => client?.close())

test("lists the saved treks, opens one, and steps through it with trek serve", async () => {
  client = new TrekClient(["bun", TREK, "serve"], await repoWithTrek())
  await client.initialize()

  const { treks } = await client.treks()
  const overview = await client.open("pay")
  const first = await client.move("next")

  expect(treks.map((trek) => trek.name)).toEqual(["pay"])
  expect(statusText(overview)).toBe("srctrek · Pay")
  expect(first).toMatchObject({ kind: "step", file: "main.ts", start_line: 1 })
  expect(statusText(first)).toBe("srctrek 1/3")
})

test("speaks the protocol version trek serve expects", async () => {
  client = new TrekClient(["bun", TREK, "serve"], await repoWithTrek())

  expect(await client.initialize()).toMatchObject({ protocol_version: 1 })
})

test("the showcase trek ends in a hop that starts a stack of its own", async () => {
  client = new TrekClient(["bun", TREK, "serve"], await repoWithShowcase())
  await client.initialize()
  await client.open("pay")
  for (let stop = 1; stop < 5; stop++) {
    await client.move("next")
  }

  expect(await client.move("next")).toMatchObject({
    kind: "step",
    step_kind: "hop",
    started_by: { name: "publish" },
  })
})
