export type ChargeRow = { charge_id: string; customer_id: string; amount_ore: number }

const rows: ChargeRow[] = [{ charge_id: "ch_1", customer_id: "cus_42", amount_ore: 49900 }]

export async function listCharges(): Promise<ChargeRow[]> {
  return rows
}
