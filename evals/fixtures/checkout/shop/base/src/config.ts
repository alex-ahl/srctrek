// Where the services this site talks to live; set per environment.
export const config = {
  paymentsUrl: process.env.PAYMENTS_URL ?? "http://payments.internal:8080",
  adminApiUrl: process.env.ADMIN_API_URL ?? "http://api.internal:8080",
}
