import { afterEach, expect, test } from "bun:test"
import { join } from "node:path"
import { repoWithTour } from "../../../packages/serve/test/support/pay-tour"
import { TrailClient } from "../src/client"
import { statusText } from "../src/view"

const TRAIL = join(import.meta.dir, "../../../packages/cli/src/main.ts")

let client: TrailClient | undefined

afterEach(() => client?.close())

test("lists the saved tours, opens one, and steps through it with trail serve", async () => {
  client = new TrailClient(["bun", TRAIL, "serve"], await repoWithTour())
  await client.initialize()

  const { tours } = await client.tours()
  const overview = await client.open("pay")
  const first = await client.move("next")

  expect(tours.map((tour) => tour.name)).toEqual(["pay"])
  expect(statusText(overview)).toBe("codetrail · Pay")
  expect(first).toMatchObject({ kind: "step", file: "main.ts", start_line: 1 })
  expect(statusText(first)).toBe("codetrail 1/3")
})

test("speaks the protocol version trail serve expects", async () => {
  client = new TrailClient(["bun", TRAIL, "serve"], await repoWithTour())

  expect(await client.initialize()).toMatchObject({ protocol_version: 1 })
})
