import { actions } from "./actions"
import { fetchOrder, renderOrder } from "./orders"

const root = document.getElementById("app")!
const orderId = new URLSearchParams(location.search).get("order")

document.addEventListener("click", (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")
  const action = el && actions[el.dataset.action ?? ""]
  if (!el || !action) return
  void Promise.resolve(action(el)).catch((err: unknown) => {
    root.insertAdjacentHTML("beforeend", `<p class="error">${String(err)}</p>`)
  })
})

if (orderId) {
  fetchOrder(orderId).then((order) => renderOrder(order, root))
}
