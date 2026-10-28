export type CartItem = { sku: string; qty: number }
export type CartRow = { id: string; customer: string; updatedAt: number; items: CartItem[] }

// In-memory tables, seeded for local runs.
export const db = {
  carts: [
    {
      id: "c_17",
      customer: "ada",
      updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
      items: [{ sku: "mug-blue", qty: 2 }],
    },
  ] as CartRow[],
  stock: new Map<string, number>([["mug-blue", 10]]),
  reserved: new Map<string, number>([["mug-blue", 2]]),
}
