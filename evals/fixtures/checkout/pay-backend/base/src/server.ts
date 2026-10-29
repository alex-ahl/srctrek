import { createServer } from "node:http"
import { routes } from "./routes"

createServer(async (req, res) => {
  const handler = routes[`${req.method} ${req.url}`]
  if (handler === undefined) {
    res.statusCode = 404
    res.end()
    return
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}")

  const { status, json } = await handler(body)
  res.statusCode = status
  res.end(JSON.stringify(json))
}).listen(8080)
