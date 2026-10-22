import { db, type OrderRow } from "../db"
import type { Handler } from "."

export function toPublic(order: OrderRow) {
  return {
    id: order.id,
    customer: order.customer,
    total: order.total_minor / 100,
    currency: order.currency,
    status: order.status,
  }
}

export const getOrder: Handler = async ({ params }) => {
  const order = db.orders.get(params.id!)
  return order ? { status: 200, body: toPublic(order) } : { status: 404 }
}
