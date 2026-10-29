import { chargeNewCard } from "./handlers/new-card"

export type Handler = (body: Record<string, unknown>) => Promise<{ status: number; json: unknown }>

export const routes: Record<string, Handler> = {
  "POST /charges": chargeNewCard,
}
