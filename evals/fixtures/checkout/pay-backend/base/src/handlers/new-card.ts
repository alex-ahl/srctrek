import { charge } from "../provider"

export async function chargeNewCard(body: Record<string, unknown>) {
  const result = await charge(String(body.card_token), Number(body.amount_ore))
  return { status: 201, json: result }
}
