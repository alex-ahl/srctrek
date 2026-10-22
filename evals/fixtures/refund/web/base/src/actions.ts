// Handlers for elements with a data-action attribute; see main.ts.
export type Action = (el: HTMLElement) => void | Promise<void>

export const actions: Record<string, Action> = {
  print: () => window.print(),
}
