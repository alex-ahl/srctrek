export async function charge(cardToken: string, amountOre: number) {
  const declined = cardToken.startsWith("tok_declined")
  return { charge_id: `ch_${Date.now()}`, status: declined ? "declined" : "succeeded", amountOre }
}
