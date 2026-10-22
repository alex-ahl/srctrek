import { readFileSync } from "node:fs"
import { createServer, type IncomingMessage } from "node:http"
import { handlers, type Handler } from "./handlers"

type Route = { method: string; pattern: RegExp; params: string[]; handler: Handler }

// Routes come from the spec: each operation's operationId names its handler.
function loadRoutes(specPath: string): Route[] {
  const spec = JSON.parse(readFileSync(specPath, "utf8")) as {
    paths: Record<string, Record<string, { operationId: string }>>
  }
  const routes: Route[] = []
  for (const [path, ops] of Object.entries(spec.paths)) {
    const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)
    const pattern = new RegExp(`^${path.replace(/\{\w+\}/g, "([^/]+)")}$`)
    for (const [method, op] of Object.entries(ops)) {
      const handler = handlers[op.operationId]
      if (!handler) throw new Error(`no handler for operationId ${op.operationId}`)
      routes.push({ method: method.toUpperCase(), pattern, params, handler })
    }
  }
  return routes
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = ""
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : undefined
}

const routes = loadRoutes(new URL("../openapi.json", import.meta.url).pathname)

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  for (const route of routes) {
    const match = req.method === route.method && route.pattern.exec(url.pathname)
    if (!match) continue
    const params = Object.fromEntries(route.params.map((name, i) => [name, decodeURIComponent(match[i + 1]!)]))
    const { status, body } = await route.handler({ params, body: await readBody(req) })
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body))
    return
  }
  res.writeHead(404).end()
}).listen(Number(process.env.PORT ?? 3000))
