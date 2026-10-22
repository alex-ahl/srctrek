import { get } from "./api"

export type Order = {
  id: string
  customer: string
  total: number
  currency: string
  status: "paid" | "shipped" | "refunded"
}

export function fetchOrder(id: string): Promise<Order> {
  return get<Order>(`/orders/${encodeURIComponent(id)}`)
}

export function renderOrder(order: Order, root: HTMLElement): void {
  root.innerHTML = `
    <h1>Order ${order.id}</h1>
    <p>${order.customer}</p>
    <p>${order.total.toFixed(2)} ${order.currency}</p>
    <p class="status">${order.status}</p>
  `
}
