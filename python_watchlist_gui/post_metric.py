#!/usr/bin/env python3
import os
import time
import requests
import sys

DASH = os.environ.get('DASHBOARD_URL', 'http://dashboard:8085').rstrip('/')
SERVICE = os.environ.get('METRIC_SERVICE', sys.argv[1] if len(sys.argv) > 1 else 'python_watchlist_gui')
INTERVAL = int(os.environ.get('METRIC_INTERVAL', '30'))

def post_once():
    payload = {'service': SERVICE, 'uptime': int(time.time()), 'requests': 0}
    try:
        requests.post(f"{DASH}/ingest", json=payload, timeout=3)
    except Exception:
        pass

if __name__ == '__main__':
    # if run with --once, post a single metric and exit
    if '--once' in sys.argv:
        post_once()
        sys.exit(0)
    # otherwise run a background loop
    try:
        while True:
            post_once()
            time.sleep(INTERVAL)
    except KeyboardInterrupt:
        pass
