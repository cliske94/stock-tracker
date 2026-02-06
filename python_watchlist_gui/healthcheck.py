#!/usr/bin/env python3
import os
import json
import time
import socket
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib import request

HEARTBEAT_FILE = '/tmp/python_heartbeat'
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8080')


def now_ms():
    return int(time.time() * 1000)


class Handler(BaseHTTPRequestHandler):
    def _write_json(self, obj, code=200):
        data = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        # Lightweight internal heartbeat used by k8s readiness probe
        if self.path == '/internal/heartbeat':
            ts = None
            try:
                with open(HEARTBEAT_FILE, 'r') as f:
                    ts = int(f.read().strip())
            except Exception:
                ts = None
            self._write_json({'last_heartbeat_ms': ts})
            return

        # Rich backend health check that exercises backend API endpoints
        if self.path == '/internal/healthcheck':
            ok = True
            details = {}
            try:
                r = request.urlopen(BACKEND_URL + '/stock?ticker=F', timeout=5)
                details['stock_get'] = r.getcode()
                if r.getcode() >= 400:
                    ok = False
            except Exception as e:
                ok = False
                details['stock_get_error'] = str(e)
            try:
                r = request.urlopen(BACKEND_URL + '/watchlist', timeout=5)
                details['watchlist_get'] = r.getcode()
                if r.getcode() >= 400:
                    ok = False
            except Exception as e:
                ok = False
                details['watchlist_get_error'] = str(e)

            # Optional safe CRUD check when enabled and token provided
            if os.environ.get('ENABLE_CRUD_CHECK', 'false').lower() == 'true':
                token = os.environ.get('BACKEND_TOKEN')
                if token:
                    try:
                        import json as _json
                        data = _json.dumps({'ticker': 'HB-TEST-' + str(int(time.time()))}).encode('utf-8')
                        req = request.Request(BACKEND_URL + '/watchlist', data=data, headers={
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        })
                        r = request.urlopen(req, timeout=5)
                        details['crud_create'] = r.getcode()
                        try:
                            resp = r.read().decode('utf-8')
                            import re
                            m = re.search(r'"id"\s*:\s*"?(\w+)"?', resp)
                            if m:
                                cb_id = m.group(1)
                                del_req = request.Request(BACKEND_URL + '/watchlist/remove?id=' + cb_id, method='POST', headers={'Authorization': 'Bearer ' + token})
                                dr = request.urlopen(del_req, timeout=5)
                                details['crud_delete'] = dr.getcode()
                        except Exception:
                            pass
                    except Exception as e:
                        details['crud_error'] = str(e)
            self._write_json({'ok': ok, 'details': details}, code=(200 if ok else 503))
            return

        # Simple VNC-based health endpoint used by the container monitor
        if self.path == '/health':
            ok = False
            try:
                s = socket.socket()
                s.settimeout(2)
                s.connect(('127.0.0.1', 5901))
                data = s.recv(12)
                s.close()
                if data and data.startswith(b'RFB'):
                    ok = True
            except Exception:
                ok = False

            if ok:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"OK")
            else:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"UNHEALTHY")
            return

        self.send_response(404)
        self.end_headers()


def run(port=9090):
    server = HTTPServer(('0.0.0.0', port), Handler)
    server.serve_forever()


if __name__ == '__main__':
    run()
