import { createServer } from "node:http"
import { cartsOlderThan, getCart } from "./carts/store"
import { STALE_CART_DAYS } from "./config"

export function startServer(port: number): void {
  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost")

    if (req.method === "GET" && url.pathname === "/admin/carts/stale") {
      const stale = await cartsOlderThan(STALE_CART_DAYS)
      res.end(JSON.stringify(stale.map((cart) => cart.id)))
      return
    }

    const match = url.pathname.match(/^\/carts\/(\w+)$/)
    if (req.method === "GET" && match) {
      res.end(JSON.stringify((await getCart(match[1]!)) ?? null))
      return
    }

    res.statusCode = 404
    res.end()
  }).listen(port)
}
