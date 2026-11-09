// Draws every screen and state of the terminal, as a person would see them, without a terminal:
// each at a wide and a narrow size, in a dark and a light terminal's colours, saved as text with
// its colours (.txt) and as a picture (.png, drawn with ImageMagick in Menlo).
//
//   bun packages/tui/test/capture-screens.tsx <out-dir> [screen]...
//
// With no screens named, it draws them all. The screens and their sample data are in
// capture/screens.tsx.
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { savePicture } from "./capture/as-picture"
import { screenText } from "./capture/as-text"
import { captureScreen } from "./capture/frame"
import { PALETTES } from "./capture/palettes"
import { SCREENS } from "./capture/screens"

const SIZES = [
  { width: 110, height: 30 },
  { width: 70, height: 22 },
]

function screensNamed(names: string[]): string[] {
  const unknown = names.filter((name) => !(name in SCREENS))
  if (unknown.length > 0) {
    throw new Error(
      `no screen ${unknown.join(", ")}; there are: ${Object.keys(SCREENS).join(", ")}`,
    )
  }

  return names.length > 0 ? names : Object.keys(SCREENS)
}

async function captureAll(out: string, names: string[]) {
  await mkdir(out, { recursive: true })

  for (const name of names) {
    for (const { width, height } of SIZES) {
      const frame = await captureScreen(SCREENS[name], width, height)
      const prefix = join(out, `${name}-${width}x${height}`)
      await Bun.write(`${prefix}.txt`, screenText(frame))

      for (const palette of PALETTES) {
        await savePicture(frame, palette, `${prefix}-${palette.name}.png`)
      }
    }
  }
}

const [out, ...names] = process.argv.slice(2)
if (out === undefined) {
  console.error("usage: bun packages/tui/test/capture-screens.tsx <out-dir> [screen]...")
  process.exit(1)
}

await captureAll(out, screensNamed(names))
console.log(`saved to ${out}`)
