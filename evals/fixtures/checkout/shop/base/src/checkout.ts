import { chargeCard } from "./clients/payments"

export type Cart = { customerId: string; totalOre: number }

// The checkout button: pays with the card the customer typed in.
export async function payWithNewCard(cart: Cart, cardToken: string): Promise<string> {
  const charge = await chargeCard(cardToken, cart.totalOre)
  return charge.status === "succeeded" ? "Thanks for your order" : "Your card was declined"
}
