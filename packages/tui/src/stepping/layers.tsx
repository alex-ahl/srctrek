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

/** What's open over the code: details, the route map, a look beside the trek, or the change. */
export type Layer =
  | Readonly<{ kind: "details" }>
  | Readonly<{ kind: "route" }>
  | Readonly<{ kind: "look"; look: Look }>
  | Readonly<{ kind: "change"; diff: readonly DiffLine[] }>

const LAYER_KEYS: Readonly<Record<Layer["kind"], readonly KeyHint[]>> = {
  details: [
    { key: "enter", does: "go there" },
    { key: "d", does: "close" },
  ],
  route: [
    { key: "enter", does: "go there" },
    { key: "tab", does: "calls, repos" },
    { key: "r", does: "close" },
  ],
  look: [
    { key: "e", does: "editor" },
    { key: ".", does: "back to the stop" },
  ],
  change: [{ key: "D", does: "the code as it is" }],
}

/** The keys a layer offers, for the footer. */
export const layerKeys = (layer: Layer) => LAYER_KEYS[layer.kind]

/** What the title bar says over a look or the change, in place of the stop's place. */
export function layerWhere(layer: Layer): string | undefined {
  if (layer.kind === "look") {
    return `${layer.look.label} · . back to the stop`
  }

  return layer.kind === "change" ? "the change · D back" : undefined
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
        onOpen={(look) => open({ kind: "look", look })}
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
        width={width}
        height={height}
        onGo={go}
        onClose={close}
        tint={tint}
      />
    )
  }

  if (layer.kind === "look") {
    return <FileAside look={layer.look} width={width} height={height} tint={tint} />
  }

  return <ChangeAside diff={layer.diff} width={width} height={height} />
}
