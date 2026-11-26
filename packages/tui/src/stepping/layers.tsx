import type { RGBA } from "@opentui/core"
import type { StepView } from "@srctrek/core"
import { type ReactNode, useState } from "react"
import type { KeyHint } from "../ui/footer"
import { ChangeAside, FileAside } from "./aside"
import type { DiffLine } from "./change"
import { DetailsPanel } from "./details-panel"
import type { Look } from "./peek"
import { RouteMap } from "./route-map"
import type { Stepping } from "./use-stepping"
import { SEPARATOR } from "../ui/separator"

/**
 * What's open over the code: details, the route map, a look beside the trek, one of `looks` when
 * a name is found in several places, or the change.
 */
export type Layer =
  | Readonly<{ kind: "details" }>
  | Readonly<{ kind: "route" }>
  | Readonly<{ kind: "look"; looks: readonly Look[]; at: number }>
  | Readonly<{ kind: "change"; diff: readonly DiffLine[] }>

/** A look at one place. */
export const lookAt = (look: Look): Layer => ({ kind: "look", looks: [look], at: 0 })

/** The look `by` places on from the one shown, round the ends; the layer as it was otherwise. */
export function lookedOn(layer: Layer, by: 1 | -1): Layer {
  if (layer.kind !== "look") {
    return layer
  }

  const count = layer.looks.length
  return { ...layer, at: (layer.at + by + count) % count }
}

const LAYER_KEYS: Readonly<Record<Layer["kind"], readonly KeyHint[]>> = {
  details: [
    { key: "enter", does: "go there" },
    { key: "d", does: "close" },
  ],
  route: [
    { key: "enter", does: "go there" },
    { key: "←/→", does: "fold" },
    { key: "c/f", does: "changed, flagged" },
    { key: "/", does: "find" },
    { key: "tab", does: "calls, repos, files" },
    { key: "r", does: "close" },
  ],
  look: [
    { key: "e", does: "editor" },
    { key: ".", does: "back to the stop" },
  ],
  change: [{ key: "D", does: "the code as it is" }],
}

const OTHER_LOOKS: KeyHint = { key: "←/→", does: "other places" }

/** The keys a layer offers, for the footer: ←/→ too on a look found in several places. */
export function layerKeys(layer: Layer): readonly KeyHint[] {
  return layer.kind === "look" && layer.looks.length > 1
    ? [OTHER_LOOKS, ...LAYER_KEYS.look]
    : LAYER_KEYS[layer.kind]
}

/** What the title bar says over a look or the change, in place of the stop's place. */
export function layerWhere(layer: Layer): string | undefined {
  if (layer.kind === "look") {
    const count = layer.looks.length
    const which = count > 1 ? `${SEPARATOR}${String(layer.at + 1)} of ${String(count)}` : ""
    return `${layer.looks[layer.at]?.label ?? ""}${which}${SEPARATOR}. back to the stop`
  }

  if (layer.kind === "route") {
    return `the route${SEPARATOR}r back`
  }

  return layer.kind === "change" ? `the change${SEPARATOR}D back` : undefined
}

/** The layer open over the code, if any; opening one closes another. */
export function useLayer() {
  const [layer, setLayer] = useState<Layer | undefined>(undefined)
  return { layer, open: setLayer, close: () => setLayer(undefined) }
}

type Drawn = Readonly<{
  layer: Layer
  view: StepView
  stepping: Extract<Stepping, { kind: "open" }>
  width: number
  height: number
  tint: RGBA | undefined
  // after going to a step: the cursor back on the stop, the layer closed
  onWent: () => void
  open: (layer: Layer) => void
  close: () => void
}>

/** The layer, drawn in the code's place. */
export function LayerView({
  layer,
  view,
  stepping,
  width,
  height,
  tint,
  onWent,
  open,
  close,
}: Drawn): ReactNode {
  const go = (id: string) => {
    stepping.go(id)
    onWent()
  }

  if (layer.kind === "details") {
    return (
      <DetailsPanel
        view={view}
        width={width}
        height={height}
        onGo={go}
        onOpen={(look) => open(lookAt(look))}
        onClose={close}
        tint={tint}
      />
    )
  }

  if (layer.kind === "route") {
    return (
      <RouteMap
        route={stepping.route}
        here={view.id}
        next={stepping.route[stepping.near.next ?? -1]?.id}
        folded={stepping.folded}
        onFold={stepping.fold}
        width={width}
        height={height}
        onGo={go}
        onClose={close}
        tint={tint}
      />
    )
  }

  const look = layer.kind === "look" ? layer.looks[layer.at] : undefined
  if (look !== undefined) {
    // keyed by place, so each place opens at its own line
    return (
      <FileAside
        key={`${look.path}:${String(look.line)}`}
        look={look}
        width={width}
        height={height}
        tint={tint}
      />
    )
  }

  return layer.kind === "change" ? (
    <ChangeAside diff={layer.diff} width={width} height={height} />
  ) : null
}
