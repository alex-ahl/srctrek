// Cards customers chose to save, by customer id.
const saved = new Map<string, string>([["cus_42", "tok_visa_4242"]])

export function savedCardOf(customerId: string): string | undefined {
  return saved.get(customerId)
}
