import { config } from "../config"

export type Charge = { charge_id: string; status: "succeeded" | "declined" }

export async function chargeCard(cardToken: string, amountOre: number): Promise<Charge> {
  const response = await fetch(`${config.paymentsUrl}/charges`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card_token: cardToken, amount_ore: amountOre }),
  })
  return (await response.json()) as Charge
}
