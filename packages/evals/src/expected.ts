import { join } from "node:path"
import { z } from "zod"

const Place = z.object({ repo: z.string(), file: z.string() })
const Line = Place.extend({ line: z.number().int().positive() })

const ExpectedSchema = z.object({
  // where trek runs, as one of the fixture's repos, and its arguments there
  run: z.object({ in: z.string(), args: z.array(z.string()) }),
  scenario: z.string(),
  route: z.array(
    Place.extend({
      lines: z.tuple([z.number().int().positive(), z.number().int().positive()]),
      note: z.string().optional(),
      // plumbing or evidence a good tour may leave out; skipping it isn't a miss
      optional: z.boolean().optional(),
    }),
  ),
  links: z.array(
    z.object({ from: Place, to: Place, evidence: z.array(Line).min(1), note: z.string() }),
  ),
  bugs: z.array(z.object({ summary: z.string(), files: z.array(Line).min(1) })),
  // the call stack under every step that shows `at`, outermost frame first, by file; a frame
  // a good tour may leave out is optional
  stacks: z
    .array(
      z.object({
        at: Line,
        frames: z.array(Place.extend({ optional: z.boolean().optional() })),
        note: z.string().optional(),
      }),
    )
    .default([]),
  // repos beside the route that a tour shouldn't step into, by folder
  decoys: z.array(z.string()).default([]),
})

/**
 * What a good tour of a fixture does: the route it walks, the links it cites, the bugs it
 * finds, the stacks it shows, the decoys it stays out of. Repos are named by their fixture
 * folder.
 */
export type Expected = z.infer<typeof ExpectedSchema>
export type ExpectedLine = z.infer<typeof Line>
export type ExpectedPlace = z.infer<typeof Place>

/** The fixture's expected.json, in the folder `dir`. */
export async function readExpected(dir: string): Promise<Expected> {
  return ExpectedSchema.parse(await Bun.file(join(dir, "expected.json")).json())
}
