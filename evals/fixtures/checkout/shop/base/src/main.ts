import { payWithNewCard } from "./checkout"

document.querySelector("#pay")?.addEventListener("click", async () => {
  const cart = JSON.parse(document.body.dataset.cart ?? "{}")
  const token = (document.querySelector("#card-token") as HTMLInputElement).value
  document.querySelector("#status")!.textContent = await payWithNewCard(cart, token)
})
