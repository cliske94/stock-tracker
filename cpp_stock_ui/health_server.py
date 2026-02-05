#!/usr/bin/env python3
import os
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib import request, parse, error

BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8080')
HEARTBEAT_FILE = '/tmp/cpp_heartbeat'

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
        if self.path == '/internal/heartbeat':
            # return last heartbeat timestamp if present
            ts = None
            try:
                with open(HEARTBEAT_FILE, 'r') as f:
                    ts = int(f.read().strip())
            except Exception:
                ts = None
                print(f"/internal/heartbeat served, last_heartbeat_ms={ts}", flush=True)
                self._write_json({'last_heartbeat_ms': ts})
            return
        if self.path == '/internal/healthcheck':
            # perform simple backend checks (safe, read-only)
            ok = True
            details = {}
            try:
                u = BACKEND_URL + '/stock?ticker=F'
                r = request.urlopen(u, timeout=5)
                details['stock_get'] = r.getcode()
                if r.getcode() >= 400:
                    ok = False
            except Exception as e:
                ok = False
                details['stock_get_error'] = str(e)
            try:
                u = BACKEND_URL + '/watchlist'
                r = request.urlopen(u, timeout=5)
                details['watchlist_get'] = r.getcode()
                if r.getcode() >= 400:
                    ok = False
            except Exception as e:
                ok = False
                details['watchlist_get_error'] = str(e)

            # Optional safe CRUD check: create then delete a short-lived watchlist entry.
            # Enabled by setting ENABLE_CRUD_CHECK=true and BACKEND_TOKEN env var.
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
                        # attempt delete by calling /watchlist/remove if returned id available
                        try:
                            resp = r.read().decode('utf-8')
                            # naive parse for id
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
            print(f"/internal/healthcheck served, ok={ok}, details={details}", flush=True)
            return
        self.send_response(404)
        self.end_headers()

def run_server(port=9090):
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f"health_server starting on 0.0.0.0:{port}", flush=True)
    server.serve_forever()

def write_heartbeat(ts=None):
    try:
        with open(HEARTBEAT_FILE, 'w') as f:
            f.write(str(ts or now_ms()))
    except Exception:
        pass

def heartbeat_worker():
    hb_url = os.environ.get('BACKEND_HEARTBEAT_URL', BACKEND_URL + '/heartbeat')
    while True:
        ts = now_ms()
        # write local heartbeat file
        write_heartbeat(ts)
        # try posting to backend
        try:
            data = json.dumps({'app': 'cpp_stock_ui', 'ts': ts}).encode('utf-8')
            req = request.Request(hb_url, data=data, headers={'Content-Type':'application/json'})
            request.urlopen(req, timeout=5)
            print(f"heartbeat POST to {hb_url} succeeded ts={ts}", flush=True)
        except Exception:
            print(f"heartbeat POST to {hb_url} failed ts={ts}", flush=True)
        time.sleep(int(os.environ.get('HEARTBEAT_INTERVAL', '30')))

if __name__ == '__main__':
    t = threading.Thread(target=heartbeat_worker, daemon=True)
    t.start()
    run_server()
