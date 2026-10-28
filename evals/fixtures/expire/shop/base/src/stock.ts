import type { CartItem } from "./db"
import { db } from "./db"

// A cart holds its items in reserve; releasing them makes them buyable again.
export async function releaseStock(items: CartItem[]): Promise<void> {
  for (const item of items) {
    const reserved = db.reserved.get(item.sku) ?? 0
    db.reserved.set(item.sku, Math.max(0, reserved - item.qty))
    db.stock.set(item.sku, (db.stock.get(item.sku) ?? 0) + item.qty)
  }
}
