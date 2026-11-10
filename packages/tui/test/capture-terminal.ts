// Runs the built trek in a real pseudo-terminal, presses keys, and saves the screen it leaves, as
// text with its colours (.txt) and as pictures in a dark and a light terminal's palette (.png):
// the real binary, renderer, and escape codes, played through a terminal emulator. Each palette
// gets a run of its own, the capture answering trek's colour queries as that terminal would.
//
//   bun packages/tui/test/capture-terminal.ts <out-prefix> [--cwd <dir>] [--size <W>x<H>]
//     [--keys "<key> <key>…"] [-- <trek args>…]
//
// Run from the repo root after `bun run build`. Keys are names (enter, esc, up, down, space) or
// characters, sent one by one once the screen has drawn; macOS only, as it uses `script`.
import { parseArgs } from "node:util"
import { resolve } from "node:path"
import { savePicture } from "./capture/as-picture"
import { screenText } from "./capture/as-text"
import { PALETTES } from "./capture/palettes"
import { playOutput, runInTerminal } from "./capture/terminal"

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cwd: { type: "string", default: "." },
    size: { type: "string", default: "110x30" },
    keys: { type: "string", default: "" },
  },
})

const [out, ...trekArgs] = positionals
const [width, height] = values.size.split("x").map(Number)
if (out === undefined || width === undefined || height === undefined) {
  console.error(
    'usage: bun packages/tui/test/capture-terminal.ts <out-prefix> [--cwd <dir>] [--size 110x30] [--keys "j enter"] [-- <trek args>]',
  )
  process.exit(1)
}

const trek = resolve("dist/trek")
const command = [trek, ...trekArgs].map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(" ")
const keys = values.keys.split(" ").filter(Boolean)

const run = { command, cwd: resolve(values.cwd), width, height, keys }

// A run per palette, as the program sees the terminal's colours and may draw with them.
for (const [i, palette] of PALETTES.entries()) {
  const frame = await playOutput(await runInTerminal(run, palette), width, height)
  if (i === 0) {
    await Bun.write(`${out}.txt`, screenText(frame))
  }

  await savePicture(frame, palette, `${out}-${palette.name}.png`)
}

console.log(`saved ${out}.txt and its pictures`)
// a program's children can outlive it and hold this process open
process.exit(0)
