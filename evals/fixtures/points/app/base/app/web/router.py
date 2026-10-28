from http.server import BaseHTTPRequestHandler, HTTPServer

ROUTES = {}


def route(method, path):
    def register(handler):
        ROUTES[(method, path)] = handler
        return handler

    return register


def serve(port):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            handler = ROUTES.get(("POST", self.path))
            self.send_response(200 if handler else 404)
            self.end_headers()

    HTTPServer(("", port), Handler).serve_forever()
