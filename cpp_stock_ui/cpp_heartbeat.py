#!/usr/bin/env python3
import os
import time
import json
from urllib import request

BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8080')
HB_URL = os.environ.get('BACKEND_HEARTBEAT_URL', BACKEND_URL + '/heartbeat')
INTERVAL = int(os.environ.get('HEARTBEAT_INTERVAL', '30'))
TS_FILE = '/tmp/cpp_heartbeat'

def now_ms():
    return int(time.time() * 1000)

def write_ts():
    try:
        with open(TS_FILE, 'w') as f:
            f.write(str(now_ms()))
    except Exception:
        pass

def send_hb():
    ts = now_ms()
    try:
        data = json.dumps({'app': 'cpp_stock_ui', 'ts': ts}).encode('utf-8')
        req = request.Request(HB_URL, data=data, headers={'Content-Type':'application/json'})
        request.urlopen(req, timeout=5)
    except Exception:
        pass
    write_ts()

def main():
    while True:
        send_hb()
        time.sleep(INTERVAL)

if __name__ == '__main__':
    main()
