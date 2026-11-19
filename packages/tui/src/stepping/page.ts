import type { KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup } from "../ui/keys-help"

/**
 * What a trek's page offers besides stepping it here: an editor to step it in, its builds, and,
 * for the change's trek, a build to start or stop.
 */
export type PageActions = Readonly<{
  editor: Readonly<{ label: string; open: () => void }> | undefined
  // the settings choose the editor: enter opens it, and n steps here
  editorFirst: boolean
  build: Readonly<{ verb: string; run: () => void }> | undefined
  stop: (() => void) | undefined
  builds: (() => void) | undefined
}>

// Enter, and the other place one key away: e for the editor, or n for here.
function placeHints({ editor, editorFirst }: PageActions): KeyHint[] {
  if (editor === undefined) {
    return [{ key: "enter", does: "step here" }]
  }

  return editorFirst
    ? [
        { key: "enter", does: editor.label },
        { key: "n", does: "step here" },
      ]
    : [
        { key: "enter", does: "step here" },
        { key: "e", does: editor.label },
      ]
}

// What acts on the trek besides stepping it.
function trekHints(page: PageActions): KeyHint[] {
  return [
    ...(page.build === undefined ? [] : [{ key: "b", does: page.build.verb }]),
    ...(page.stop === undefined ? [] : [{ key: "x", does: "stop" }]),
    ...(page.builds === undefined ? [] : [{ key: "l", does: "builds" }]),
  ]
}

/** The page's footer: where enter steps the trek and the other place, then what acts on it. */
export function pageHints(page: PageActions): KeyHint[] {
  return [...placeHints(page), ...trekHints(page), HELP_HINT]
}

/** Every key on the page, for the panel ? opens. */
export function pageGroups(page: PageActions): KeyGroup[] {
  return [
    { title: "this trek", keys: [...placeHints(page), ...trekHints(page)] },
    { title: "leave", keys: [{ key: "q", does: "home" }] },
  ]
}

/** What the page's keys do; `start` steps the trek here, from its first stop. */
export function pageKeys(page: PageActions, start: () => void): ReadonlyMap<string, () => void> {
  const { editor, editorFirst } = page
  const enter = editorFirst && editor !== undefined ? editor.open : start

  return new Map([
    ["return", enter],
    ["e", () => editor?.open()],
    ["b", () => page.build?.run()],
    ["x", () => page.stop?.()],
    ["l", () => page.builds?.()],
  ])
}
