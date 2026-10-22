export type OrderRow = {
  id: string
  customer: string
  total_minor: number
  currency: string
  status: "paid" | "shipped" | "refunded"
}

// In-memory tables; seeded with one order for local runs.
export const db = {
  orders: new Map<string, OrderRow>([
    ["o_1001", { id: "o_1001", customer: "Bob Example", total_minor: 49900, currency: "SEK", status: "paid" }],
  ]),
}
