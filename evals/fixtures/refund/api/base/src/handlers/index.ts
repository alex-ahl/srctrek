import { getOrder } from "./orders"

export type Request = { params: Record<string, string>; body: unknown }
export type Response = { status: number; body?: unknown }
export type Handler = (req: Request) => Promise<Response>

// Keyed by operationId in openapi.json.
export const handlers: Record<string, Handler> = {
  getOrder,
}
