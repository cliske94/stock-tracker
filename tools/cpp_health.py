#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health' or self.path == '/healthz':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        return

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8082), HealthHandler)
    print('cpp health server listening on 8082')
    server.serve_forever()
