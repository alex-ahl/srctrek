import { cartsOlderThan, deleteCart } from "../carts/store"
import { CART_TTL_DAYS } from "../config"
import { releaseStock } from "../stock"

export async function expireCarts(): Promise<void> {
  const expired = await cartsOlderThan(CART_TTL_DAYS)
  for (const cart of expired) {
    await releaseStock(cart.items)
    await deleteCart(cart.id)
  }
  console.log(`expired ${expired.length} carts`)
}
