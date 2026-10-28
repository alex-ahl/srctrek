import { type CartRow, db } from "../db"

export async function getCart(id: string): Promise<CartRow | undefined> {
  return db.carts.find((cart) => cart.id === id)
}

export async function cartsOlderThan(days: number): Promise<CartRow[]> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return db.carts.filter((cart) => cart.updatedAt < cutoff)
}

export async function deleteCart(id: string): Promise<void> {
  db.carts = db.carts.filter((cart) => cart.id !== id)
}
