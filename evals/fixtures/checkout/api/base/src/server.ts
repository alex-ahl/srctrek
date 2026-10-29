import { createServer } from "node:http"
import { listCharges } from "./charges"

// The internal admin API: read-only views for the support team.
createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/charges") {
    res.end(JSON.stringify(await listCharges()))
    return
  }

  res.statusCode = 404
  res.end()
}).listen(8080)
